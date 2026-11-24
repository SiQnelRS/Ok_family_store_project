import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Stripe from "stripe";
import { createDatabaseClient } from "../packages/database/dist/index.js";
import { createApp } from "../apps/commerce-service/dist/app.js";
import { PaymentsService } from "../apps/commerce-service/dist/payments.js";
import { StripeClient } from "../apps/commerce-service/dist/stripe-client.js";
import { OrdersService } from "../apps/commerce-service/dist/orders.js";

test("Stripe: autorización, firma, deduplicación, rechazo, vencimiento y conciliación", async () => {
  // Use the real HTTP parser, signature verifier and database. Only the Stripe API is simulated.
  process.env.STRIPE_SECRET_KEY = "rk_test_fixture";
  const secret = "whsec_" + randomUUID();
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const db = createDatabaseClient();
  const app = await createApp({logger:false});
  const userId = randomUUID(), events = [], products = [];
  const sessions = new Map(), keys = new Map(), refunds = new Map();
  const stripe = new Stripe("sk_test_fixture");
  const endpoint = {
    async create(input, {idempotencyKey}) {
      const cached = keys.get(idempotencyKey);
      if (cached) return sessions.get(cached);
      assert.deepEqual(input.allowed_payment_method_types, ["card"]);
      const session = {id:"cs_test_" + randomUUID(), status:"open",mode:"payment",payment_status:"unpaid",
        currency:"mxn",amount_total:input.line_items[0].price_data.unit_amount,livemode:false,
        client_reference_id:input.client_reference_id,metadata:input.metadata,payment_intent:null,
        url:"https://checkout.stripe.com/c/pay/" + randomUUID()};
      sessions.set(session.id,session);
      keys.set(idempotencyKey,session.id);
      return session;
    },
    async retrieve(id) {return sessions.get(id);},
    async expire(id) {sessions.get(id).status = "expired"; return sessions.get(id);},
  };
  const fake = {webhooks:stripe.webhooks,checkout:{sessions:endpoint},refunds:{
    async create(params,{idempotencyKey}) {
      assert.equal(params.amount, 12500);
      if (!refunds.has(idempotencyKey)) refunds.set(idempotencyKey,{id:"re_"+randomUUID(),status:"pending"});
      return refunds.get(idempotencyKey);
    },
    async retrieve(id) {return {id,status:"succeeded"};},
  }};
  Object.defineProperty(app.get(StripeClient),"api",{value:fake});
  const payments = app.get(PaymentsService);
  async function fixture() {
    const order = await db.order.create({data:{userId,shippingAddressSnapshot:{method:"pickup"},subtotalInCents:12500,totalInCents:12500,shippingInCents:0}});
    const product = await db.product.create({data:{slug:"stripe-"+randomUUID(),name:"Lote",description:"Fixture",category:"Prueba",priceInCents:12500,availableQuantity:0,reservedQuantity:1}});
    products.push(product.id);
    await db.reservation.create({data:{orderId:order.id,userId,idempotencyKey:randomUUID(),expiresAt:new Date(Date.now()+900000),items:{create:{productId:product.id,quantity:1}}}});
    await assert.rejects(payments.start(randomUUID(),order.id),e=>e.getStatus()===404);
    const [first,retry] = await Promise.all([payments.start(userId,order.id),payments.start(userId,order.id)]);
    assert.equal(first.url,retry.url);
    const payment = await db.payment.findFirstOrThrow({where:{orderId:order.id}});
    return {order,product,session:sessions.get(payment.checkoutSessionId),payment};
  }
  async function stock(product) {
    return db.product.findUniqueOrThrow({where:{id:product.id},select:{availableQuantity:true,reservedQuantity:true,soldQuantity:true}});
  }
  function capture(session) {
    session.status="complete"; session.payment_status="paid";
    session.payment_intent={id:"pi_"+randomUUID(),status:"succeeded",livemode:false,
      metadata:session.metadata,amount_received:session.amount_total,currency:"mxn"};
  }
  async function deliver(object,type,id="evt_"+randomUUID(), signingSecret=secret) {
    events.push(id);
    const payload=JSON.stringify({id,type,livemode:false,data:{object}},null,2);
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:signingSecret});
    return fetch((await app.getUrl())+"/api/payments/stripe/webhook",{method:"POST",
      headers:{"content-type":"application/json","stripe-signature":signature},body:payload});
  }
  const current = payment => db.payment.findUniqueOrThrow({where:{id:payment.id}});
  try {
    await app.listen(0,"127.0.0.1");
    process.env.STRIPE_WEBHOOK_SECRET=secret;
    const success=await fixture();
    capture(success.session);
    assert.equal((await deliver(success.session,"checkout.session.completed",undefined,"wrong")).status,400);
    assert.equal((await current(success.payment)).status,"PENDIENTE");
    const eventId="evt_"+randomUUID();
    const results=await Promise.all([1,2].map(()=>deliver(success.session,"checkout.session.completed",eventId)));
    assert.ok(results.every(r=>r.status===200));
    assert.equal((await current(success.payment)).status,"EXITOSO");
    assert.equal((await db.order.findUniqueOrThrow({where:{id:success.order.id}})).status,"PAGADO");
    assert.deepEqual(await stock(success.product),{reservedQuantity:0,availableQuantity:0,soldQuantity:1});
    assert.equal(await db.webhookEvent.count({where:{eventId}}),1);

    const rejected=await fixture();
    rejected.session.payment_intent={id:"pi_"+randomUUID(),status:"requires_payment_method",last_payment_error:{code:"card_declined"},metadata:rejected.session.metadata};
    assert.equal((await deliver(rejected.session.payment_intent,"payment_intent.payment_failed")).status,200);
    assert.equal((await current(rejected.payment)).status,"FALLIDO");
    assert.equal((await stock(rejected.product)).availableQuantity,1);

    const abandoned=await fixture();
    await db.reservation.update({where:{orderId:abandoned.order.id},data:{createdAt:new Date(Date.now()-120000),expiresAt:new Date(Date.now()-60000)}});
    await payments.reconcilePayment(await current(abandoned.payment));
    assert.equal(abandoned.session.status,"expired");
    assert.equal((await current(abandoned.payment)).status,"FALLIDO");

    const late=await fixture();
    await app.get(OrdersService).cancel(userId,late.order.id);
    capture(late.session);
    // Missing webhook: polling discovers the payment and refunds it without selling again.
    await payments.reconcilePayment(await current(late.payment));
    assert.equal((await current(late.payment)).status,"PENDIENTE_REEMBOLSO");
    await payments.reconcilePayment(await current(late.payment));
    await payments.reconcilePayment(await current(late.payment));
    assert.equal((await current(late.payment)).status,"REEMBOLSADO");
    assert.equal(refunds.size,1);
    assert.deepEqual(await stock(late.product),{availableQuantity:1,reservedQuantity:0,soldQuantity:0});

    const mismatch=await fixture();
    capture(mismatch.session);
    mismatch.session.amount_total++;
    assert.equal((await deliver(mismatch.session,"checkout.session.completed")).status,200);
    assert.equal((await current(mismatch.payment)).status,"EN_REVISION");
    assert.equal((await stock(mismatch.product)).soldQuantity,0);
  } finally {
    await app.close();
    await db.webhookEvent.deleteMany({where:{eventId:{in:events}}});
    await db.payment.deleteMany({where:{order:{userId}}});
    await db.reservation.deleteMany({where:{userId}});
    await db.order.deleteMany({where:{userId}});
    await db.product.deleteMany({where:{id:{in:products}}});
    await db.$disconnect();
  }
});
