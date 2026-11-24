import { BadRequestException, ConflictException, Controller, Headers, HttpCode, Injectable, Logger, NotFoundException, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import type Stripe from "stripe";
import { createDatabaseClient, finishCatalogReservation, type Prisma } from "@ok-family/database";
import { serviceUrl } from "@ok-family/service-kit";
import { StripeClient, stripeCheckoutEnabled, stripeConfigured, stripeLivemode } from "./stripe-client.js";

const checkoutKey = (orderId: string) => "checkout-v1:" + orderId;
const nextCheck = () => new Date(Date.now() + 60000);
const supportedEvents = new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);

@Injectable()
export class PaymentsService {
  private client?: ReturnType<typeof createDatabaseClient>;
  private get db() { return this.client ??= createDatabaseClient(); }
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(private readonly stripe: StripeClient) {}

  onModuleInit() {
    if (!stripeConfigured()) return;
    const run = () => {
      this.running ??= this.reconcile()
        .catch(() => Logger.error("No se pudo conciliar con Stripe.", "Pagos"))
        .finally(() => { this.running = undefined; });
    };
    run();
    this.timer = setInterval(run, 15000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
    await this.client?.$disconnect();
  }

  async start(userId: string, orderId: string) {
    const order = await this.db.order.findFirst({where: {id: orderId, userId}});
    if (!order) throw new NotFoundException("Pedido no encontrado.");
    if (!stripeCheckoutEnabled())
      throw new ServiceUnavailableException("El pago con Stripe no está disponible en este momento.");
    const livemode = stripeLivemode();
    const api = this.stripe.api;
    const reservation = await this.db.reservation.findUnique({where: {orderId}});
    if (order.status !== "PENDIENTE_PAGO" || reservation?.status !== "ACTIVA" || reservation.expiresAt <= new Date())
      throw new ConflictException("La reserva ya no está disponible para pagar.");
    const key = checkoutKey(orderId);
    await this.db.payment.createMany({
      data: [{orderId, idempotencyKey: key, stripeLivemode: livemode, nextSyncAt:nextCheck(), amountInCents: order.totalInCents, currency: order.currency}],
      skipDuplicates: true,
    });
    const payment = await this.db.payment.findUniqueOrThrow({where:{idempotencyKey:key}});
    if (payment.stripeLivemode !== livemode || payment.status !== "PENDIENTE")
      throw new ConflictException("Consulta el estado del pago en Mis pedidos.");
    const returnUrl = serviceUrl("WEB_ORIGIN", "http://localhost:3000") + "/cuenta/pedidos";
    let session: Stripe.Checkout.Session;
    try {
      session = payment.checkoutSessionId
        ? await api.checkout.sessions.retrieve(payment.checkoutSessionId)
        : await api.checkout.sessions.create({
          mode: "payment", allowed_payment_method_types: ["card"], locale: "es",
          adaptive_pricing: {enabled:false},
          client_reference_id: orderId, metadata: {paymentId: payment.id, orderId},
          payment_intent_data: {metadata: {paymentId: payment.id, orderId}},
          line_items: [{quantity: 1, price_data: {currency: payment.currency.toLowerCase(),
            unit_amount: payment.amountInCents, product_data: {name: "OK Family · Pedido " + orderId.slice(0,8).toUpperCase()}}}],
          success_url: returnUrl, cancel_url: returnUrl,
        }, {idempotencyKey: key});
    } catch (error) {
      this.logStripeError("No se pudo abrir Checkout", payment.id, error);
      throw new ServiceUnavailableException("Stripe no pudo abrir el pago. Puedes volver a intentarlo desde este pedido.");
    }
    if (session.livemode !== livemode || session.mode !== "payment" || session.client_reference_id !== orderId
        || session.metadata?.paymentId !== payment.id || session.amount_total !== order.totalInCents
        || session.currency !== order.currency.toLowerCase()) {
      Logger.error("Checkout no coincide con el pedido. Pago: " + payment.id, "Pagos");
      throw new ServiceUnavailableException("No pudimos verificar la sesión de pago.");
    }
    if (!payment.checkoutSessionId) {
      const linked = await this.db.payment.updateMany({where:{id:payment.id,status:"PENDIENTE"},data:{checkoutSessionId:session.id,nextSyncAt:nextCheck()}});
      if (!linked.count) throw new ConflictException("Este pedido ya no admite pagos.");
    }
    if (session.status !== "open" || !session.url || new URL(session.url).origin !== "https://checkout.stripe.com")
      throw new ConflictException("El pago se está verificando. Revisa Mis pedidos.");
    return {url: session.url};
  }

  async webhook(raw: Buffer | undefined, signature?: string) {
    if (!raw || !signature) throw new BadRequestException("Se requiere la firma de Stripe.");
    const api = this.stripe.api;
    let event: Stripe.Event;
    try { event = api.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!); }
    catch { throw new BadRequestException("Firma de Stripe inválida."); }
    if (event.livemode !== stripeLivemode()) throw new BadRequestException("El evento pertenece a otro modo de Stripe.");
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      if (!intent.metadata.orderId) return;
      const payment = await this.db.payment.findUnique({where:{idempotencyKey:checkoutKey(intent.metadata.orderId)}});
      if (!payment?.checkoutSessionId || payment.id !== intent.metadata.paymentId
          || payment.stripeLivemode !== event.livemode || payment.status !== "PENDIENTE") return;
      await this.syncSession(payment.id,payment.checkoutSessionId,event);
      return;
    }
    if (!supportedEvents.has(event.type)) return;
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.metadata?.paymentId) return;
    const payment = await this.db.payment.findUnique({where:{checkoutSessionId:session.id}});
    if (!payment) {
      // Stripe can deliver an event before the local record stores the Checkout session ID.
      const pending = await this.db.payment.findUnique({where:{idempotencyKey:checkoutKey(session.client_reference_id ?? "")}});
      if (pending?.id === session.metadata.paymentId && pending.stripeLivemode === event.livemode
          && pending.status === "PENDIENTE" && !pending.checkoutSessionId)
        throw new ServiceUnavailableException("Sesión pendiente de vincular.");
      return;
    }
    if (payment.stripeLivemode !== event.livemode || payment.status !== "PENDIENTE") return;
    if (await this.db.webhookEvent.findUnique({where:{eventId:event.id}})) return;
    await this.syncSession(payment.id, session.id, event);
  }

  private async syncSession(paymentId: string, sessionId: string, event?: Stripe.Event) {
    const sessions = this.stripe.api.checkout.sessions;
    let session = await sessions.retrieve(sessionId, {expand:["payment_intent"]});
    const attempt = session.payment_intent;
    if (session.livemode === stripeLivemode() && session.status === "open" && typeof attempt === "object" && attempt?.status === "requires_payment_method" && attempt.last_payment_error) {
      // Close the session at Stripe before releasing stock; if checkout won the race, retry with its latest state.
      await sessions.expire(sessionId);
      session = await sessions.retrieve(sessionId, {expand:["payment_intent"]});
    }
    await this.db.$transaction(async tx => {
      // Serialize polling, duplicate notifications and different events for one payment.
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({where:{id:paymentId}, include:{order:true}});
      if (event) {
        const recorded = await tx.webhookEvent.createMany({data:[{eventId:event.id,type:event.type,processedAt:new Date()}],skipDuplicates:true});
        if (!recorded.count) return;
      }
      if (payment.status !== "PENDIENTE") return;
      const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
      const amount = payment.amountInCents;
      const currency = payment.currency.toLowerCase();
      if (session.livemode !== payment.stripeLivemode || session.mode !== "payment" || session.id !== payment.checkoutSessionId
          || session.metadata?.paymentId !== payment.id || session.client_reference_id !== payment.orderId
          || session.amount_total !== amount || session.currency !== currency
          || amount !== payment.order.totalInCents || payment.order.currency !== payment.currency) {
        await tx.payment.update({where:{id:payment.id},data:{status:"EN_REVISION",nextSyncAt:null}});
        Logger.error("Importe, moneda o referencia de Checkout no coincide. Pago: " + payment.id, "Pagos");
        return;
      }
      if (session.status === "expired") {
        await tx.payment.update({where:{id:payment.id},data:{status:"FALLIDO",nextSyncAt:null}});
        if (await finishCatalogReservation(tx,payment.orderId,"LIBERADA",new Date()))
          await tx.order.update({where:{id:payment.orderId,status:"PENDIENTE_PAGO"},data:{status:"CANCELADO"}});
        return;
      }
      if (session.status !== "complete" || session.payment_status !== "paid") return;
      if (!intent || intent.livemode !== payment.stripeLivemode || intent.status !== "succeeded" || intent.amount_received !== amount
          || intent.currency !== currency || intent.metadata.paymentId !== payment.id || intent.metadata.orderId !== payment.orderId) {
        await tx.payment.update({where:{id:payment.id},data:{status:"EN_REVISION",nextSyncAt:null}});
        Logger.error("PaymentIntent no coincide con el pedido. Pago: " + payment.id, "Pagos");
        return;
      }
      const confirmed = payment.order.status === "PENDIENTE_PAGO"
        && await finishCatalogReservation(tx, payment.orderId, "CONFIRMADA", new Date());
      if (confirmed) {
        await tx.order.update({where:{id:payment.orderId,status:"PENDIENTE_PAGO"},data:{status:"PAGADO"}});
      }
      await tx.payment.update({where:{id:payment.id},data:{
        stripePaymentId:intent.id, status:confirmed ? "EXITOSO" : "PENDIENTE_REEMBOLSO",
        nextSyncAt: confirmed ? null : new Date(),
      }});
    });
  }

  private async reconcile() {
    const due = await this.db.payment.findMany({
      where:{stripeLivemode:stripeLivemode(),nextSyncAt:{lte:new Date()},status:{in:["PENDIENTE","PENDIENTE_REEMBOLSO"]}},
      orderBy:{nextSyncAt:"asc"},take:25,
    });
    for (const payment of due) {
      try {
        await this.reconcilePayment(payment);
      } catch (error) {
        this.logStripeError("Se reintentará la conciliación", payment.id, error);
      }
    }
  }

  private logStripeError(operation: string, paymentId: string, error: unknown) {
    const type = error instanceof Error ? error.constructor.name : "Error";
    Logger.warn(operation + ". Pago: " + paymentId + ". Tipo: " + type, "Pagos");
  }

  async reconcilePayment(payment: Prisma.PaymentGetPayload<object>) {
    if (payment.stripeLivemode !== stripeLivemode()) return;
    const claimed = await this.db.payment.updateMany({
      where:{id:payment.id,nextSyncAt:payment.nextSyncAt,status:payment.status},data:{nextSyncAt:nextCheck()},
    });
    if (!claimed.count) return;
    if (payment.status === "PENDIENTE_REEMBOLSO" && payment.stripePaymentId) {
      const refund = payment.refundId ? await this.stripe.api.refunds.retrieve(payment.refundId)
        : await this.stripe.api.refunds.create({payment_intent:payment.stripePaymentId,amount:payment.amountInCents},
          {idempotencyKey:"refund-v1:" + payment.id});
      const status = refund.status === "succeeded" ? "REEMBOLSADO"
        : refund.status === "pending" ? "PENDIENTE_REEMBOLSO" : "EN_REVISION";
      if (status === "EN_REVISION") Logger.error("Reembolso requiere revisión. Pago: " + payment.id, "Pagos");
      await this.db.payment.updateMany({where:{id:payment.id,status:"PENDIENTE_REEMBOLSO"},data:{
        refundId:refund.id,status,nextSyncAt:status === "PENDIENTE_REEMBOLSO" ? nextCheck() : null,
      }});
    } else if (payment.checkoutSessionId) {
      const reservation = await this.db.reservation.findUnique({where:{orderId:payment.orderId}});
      if (reservation?.status !== "ACTIVA" || reservation.expiresAt <= new Date()) {
        const session = await this.stripe.api.checkout.sessions.retrieve(payment.checkoutSessionId);
        if (session.status === "open") await this.stripe.api.checkout.sessions.expire(session.id);
      }
      await this.syncSession(payment.id,payment.checkoutSessionId);
    }
    else {
      const reservation = await this.db.reservation.findUnique({where:{orderId:payment.orderId}});
      if (reservation?.status !== "ACTIVA" || reservation.expiresAt <= new Date())
        await this.db.payment.updateMany({where:{id:payment.id,status:"PENDIENTE",checkoutSessionId:null},data:{status:"FALLIDO",nextSyncAt:null}});
    }
  }
}

@Controller("payments/stripe")
export class StripeWebhookController {
  constructor(private readonly payments: PaymentsService) {}
  @Post("webhook") @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<IncomingMessage>, @Headers("stripe-signature") signature?: string) {
    await this.payments.webhook(request.rawBody, signature);
    return {received:true};
  }
}
