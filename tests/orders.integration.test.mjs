import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabaseClient, finishCatalogReservation } from "../packages/database/dist/index.js";
import { OrdersService, cartVersion } from "../apps/commerce-service/dist/orders.js";

test("reservas concurrentes, reversión, reintentos y liberación", async () => {
  const db = createDatabaseClient();
  const services = [new OrdersService(), new OrdersService()];
  const users = [randomUUID(), randomUUID()];
  const products = [];
  async function product() {
    const value = await db.product.create({data: {slug: "reserva-" + randomUUID(), name: "Lote de prueba", description: "Prueba", category: "Prueba", type: "LOTE", piecesPerUnit: 8, priceInCents: 900, availableQuantity: 1, published: true}});
    products.push(value); return value;
  }
  function add(userId, item) {
    return db.cartItem.create({data: {userId, productId: item.id, slug: item.slug, quantity: 1}});
  }
  function checkout(items) {
    return {method: "pickup", key: randomUUID(), totalInCents: items.length * 900, version: cartVersion(items.map(product => ({product, quantity: 1})))};
  }
  try {
    const item = await product();
    await Promise.all(users.map(user => add(user, item)));
    const inputs = users.map(() => checkout([item]));
    const outcomes = await Promise.allSettled(services.map((service, i) => service.create(users[i], inputs[i])));
    const winner = outcomes.findIndex(result => result.status === "fulfilled");
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(outcomes[1-winner].reason.getStatus(), 409);
    const {orderId} = outcomes[winner].value;
    assert.equal((await services[winner].create(users[winner], inputs[winner])).orderId, orderId);
    assert.equal((await db.product.findUniqueOrThrow({where: {id: item.id}})).reservedQuantity, 1);
    await assert.rejects(services[0].cancel(users[1-winner], orderId), error => error.getStatus() === 404);
    await Promise.all(services.map(service => service.cancel(users[winner], orderId)));
    assert.equal((await db.product.findUniqueOrThrow({where: {id: item.id}})).availableQuantity, 1);
    const other = await product();
    const user = users[1-winner];
    await add(user, other);
    const sorted = [item, other].sort((a,b) => a.id.localeCompare(b.id));
    await db.product.update({where: {id: sorted[1].id}, data: {availableQuantity: 0}});
    await assert.rejects(services[0].create(user, checkout(sorted)), error => error.getStatus() === 409);
    assert.equal((await db.product.findUniqueOrThrow({where: {id: sorted[0].id}})).reservedQuantity, 0);
    assert.equal(await db.cartItem.count({where: {userId: user}}), 2);
    await db.product.update({where: {id: sorted[1].id}, data: {availableQuantity: 1}});
    const request = checkout(sorted);
    const [first, retry] = await Promise.all(services.map(service => service.create(user, request)));
    assert.equal(first.orderId, retry.orderId);
    await db.reservation.update({where: {orderId: first.orderId}, data: {createdAt: new Date(Date.now()-120000), expiresAt: new Date(Date.now()-60000)}});
    await services[0].expire(); await services[1].expire();
    assert.equal((await db.order.findUniqueOrThrow({where: {id: first.orderId}})).status, "CANCELADO");
    for (const p of sorted) assert.equal((await db.product.findUniqueOrThrow({where: {id:p.id}})).availableQuantity, 1);
    await add(user, item);
    const confirmed = await services[0].create(user, checkout([item]));
    for (const expected of [true, false]) {
      assert.equal(await db.$transaction(tx => finishCatalogReservation(tx, confirmed.orderId, "CONFIRMADA", new Date())), expected);
    }
    assert.equal((await db.product.findUniqueOrThrow({where:{id:item.id}})).soldQuantity, 1);
  } finally {
    await Promise.all(services.map(service => service.onModuleDestroy()));
    await db.reservation.deleteMany({where: {userId: {in: users}}});
    await db.orderItem.deleteMany({where: {order: {userId: {in: users}}}});
    await db.order.deleteMany({where: {userId: {in: users}}});
    await db.cartItem.deleteMany({where: {userId: {in: users}}});
    await db.product.deleteMany({where: {id: {in: products.map(item => item.id)}}});
    await db.$disconnect();
  }
});
