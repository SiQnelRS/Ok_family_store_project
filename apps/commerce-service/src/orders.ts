import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createDatabaseClient, finishCatalogReservation, holdCatalogUnit, type Prisma } from "@ok-family/database";
import type { CheckoutDto } from "@ok-family/service-kit";
import { localCoverage } from "./coverage.js";

export function cartVersion(items: {product: {id: string; priceInCents: number} | null; quantity: number}[]) {
  const lines = items.map(({product, quantity}) => [product?.id, quantity, product?.priceInCents]).sort();
  return createHash("sha256").update(JSON.stringify(lines)).digest("hex");
}

@Injectable()
export class OrdersService {
  private client?: ReturnType<typeof createDatabaseClient>;
  private get db() {return this.client ??= createDatabaseClient();}
  private timer?: NodeJS.Timeout;
  private sweep?: Promise<void>;
  onModuleInit() {
    const run = () => {
      this.sweep ??= this.expire().catch(() => Logger.error("No se pudieron liberar las reservas vencidas.", "Pedidos")).finally(() => {this.sweep = undefined;});
    };
    run();
    this.timer = setInterval(run, 15000);
    this.timer.unref();
  }
  async onModuleDestroy() {clearInterval(this.timer); await this.sweep; await this.client?.$disconnect();}
  private async expire() {
    const now = new Date();
    const due = await this.db.reservation.findMany({where: {status: "ACTIVA", expiresAt: {lte: now}}, select: {orderId: true}, orderBy: {expiresAt: "asc"}, take: 100});
    for (const {orderId} of due) {
      await this.db.$transaction(async tx => {
        if (await finishCatalogReservation(tx, orderId, "EXPIRADA", now))
          await tx.order.update({where: {id: orderId, status: "PENDIENTE_PAGO"}, data: {status: "CANCELADO"}});
      });
    }
  }
  async list(userId: string): Promise<Array<Prisma.OrderGetPayload<{include: {items: true}}> & {reservation?: Prisma.ReservationGetPayload<{select: {orderId: true; status: true; expiresAt: true}}> }>> {
    const orders = await this.db.order.findMany({where: {userId}, orderBy: {createdAt: "desc"}, include: {items: true}, take: 50});
    const reservations = await this.db.reservation.findMany({where: {orderId: {in: orders.map(order => order.id)}}, select: {orderId: true, status: true, expiresAt: true}});
    return orders.map(order => ({...order, reservation: reservations.find(row => row.orderId === order.id)}));
  }
  async cancel(userId: string, id: string) {
    return this.db.$transaction(async tx => {
      const order = await tx.order.findFirst({where: {id, userId}});
      if (!order) throw new NotFoundException("Pedido no encontrado.");
      if (order.status === "CANCELADO") return {id};
      if (order.status !== "PENDIENTE_PAGO") throw new ConflictException("Ya no se puede cancelar este pedido.");
      if (await finishCatalogReservation(tx, id, "LIBERADA", new Date()))
        await tx.order.update({where: {id, status: "PENDIENTE_PAGO"}, data: {status: "CANCELADO"}});
      else if ((await tx.order.findUniqueOrThrow({where: {id}})).status !== "CANCELADO")
        throw new ConflictException("El pedido cambió. Actualiza la página.");
      return {id};
    });
  }
  async create(userId: string, input: CheckoutDto) {
    const key = userId + ":" + input.key;
    const replay = () => this.db.reservation.findUnique({where: {idempotencyKey: key}, select: {orderId: true}});
    for (let attempt = 0; ; attempt++) {
      const existing = await replay();
      if (existing) return existing;
      try {
        return await this.db.$transaction(async tx => {
          const prior = await tx.reservation.findUnique({where: {idempotencyKey: key}});
          if (prior) return {orderId: prior.orderId};
          const cart = await tx.cartItem.findMany({where: {userId}, orderBy: {productId: "asc"}});
          if (!cart.length) throw new ConflictException("Tu carrito está vacío.");
          let shippingInCents = 0;
          let destination: Prisma.InputJsonObject = {method: "pickup", store: "Boulevard de las Rosas 233, Jardines de Durango, Durango"};
          if (input.method === "delivery") {
            const address = input.addressId && await tx.address.findFirst({where: {id: input.addressId, userId}});
            if (!address) throw new NotFoundException("Selecciona una dirección válida.");
            const coverage = localCoverage(address.postalCode);
            if (coverage.status !== "available") throw new ConflictException("Entrega no disponible para esta dirección.");
            shippingInCents = coverage.priceInCents!;
            const {createdAt, updatedAt, ...snapshot} = address;
            destination = {...snapshot, method: "delivery"};
          }
          const items = [];
          const versionRows = [];
          for (const line of cart) {
            const product = await holdCatalogUnit(tx, line.productId, line.slug, line.quantity);
            if (!product) throw new ConflictException("Cambió la disponibilidad. Revisa tu carrito.");
            versionRows.push({product, quantity: line.quantity});
            items.push({productId: product.id, productName: product.name, productType: product.type, piecesPerUnit: product.piecesPerUnit, quantity: line.quantity, unitPriceInCents: product.priceInCents, subtotalInCents: product.priceInCents * line.quantity});
          }
          const subtotalInCents = items.reduce((sum, item) => sum + item.subtotalInCents, 0);
          const totalInCents = subtotalInCents + shippingInCents;
          if (cartVersion(versionRows) !== input.version || totalInCents !== input.totalInCents || totalInCents > 2147483647)
            throw new ConflictException("El carrito o la tarifa cambiaron. Actualiza el resumen.");
          const order = await tx.order.create({data: {userId, addressId: input.method === "delivery" ? input.addressId : null, shippingAddressSnapshot: destination, subtotalInCents, shippingInCents, totalInCents, items: {create: items}}});
          await tx.reservation.create({data: {orderId: order.id, userId, idempotencyKey: key, expiresAt: new Date(Date.now() + 15 * 60000), items: {create: items.map(({productId, quantity}) => ({productId, quantity}))}}});
          await tx.cartItem.deleteMany({where: {id: {in: cart.map(item => item.id)}}});
          return {orderId: order.id};
        }, {isolationLevel: "Serializable", timeout: 15000});
      } catch (error) {
        const code = (error as {code?: string}).code;
        if (code !== "P2034" && code !== "P2002") throw error;
        if (attempt >= 3) {
          const result = await replay();
          if (result) return result;
          throw new ConflictException("El inventario cambió. Vuelve a revisar tu carrito.");
        }
      }
    }
  }
}
