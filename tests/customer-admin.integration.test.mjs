import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../packages/database/dist/index.js";
import { hashPassword } from "../packages/service-kit/dist/index.js";
import { createApp as authApp } from "../apps/auth-service/dist/app.js";
import { createApp as gatewayApp } from "../apps/api-gateway/dist/app.js";

test("administración de clientes: permisos, búsqueda y cambios de acceso", async () => {
  const db = createDatabaseClient(), apps = [], marker = randomUUID();
  const password = "Prueba-" + marker, email = "cliente-" + marker + "@example.test";
  let customer, admin;
  async function listen(app) { apps.push(app); await app.listen(0, "127.0.0.1"); return app.getUrl(); }
  async function request(base, path, method = "GET", body, token) {
    const r = await fetch(base + path, {method, headers: {"content-type": "application/json", ...(token ? {authorization: "Bearer " + token} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
    return {status: r.status, body: await r.json()};
  }
  try {
    const passwordHash = await hashPassword(password);
    admin = await db.user.create({data: {name: "Dueño de prueba", email: "admin-" + marker + "@example.test", passwordHash, role: "ADMIN"}});
    customer = await db.user.create({data: {name: "Cliente de prueba", email, passwordHash, role: "CUSTOMER"}});
    const auth = await listen(await authApp({logger: false}));
    const gateway = await listen(await gatewayApp({authUrl: auth, catalogUrl: auth, commerceUrl: auth}, {logger: false}));
    const owner = await request(gateway, "/api/auth/admin/login", "POST", {email: admin.email, password});
    const client = await request(gateway, "/api/auth/customer/login", "POST", {email, password});
    assert.equal(owner.status, 200); assert.equal(client.status, 200);
    const adminToken = owner.body.token, customerToken = client.body.token;
    for (const base of [auth, gateway]) {
      assert.equal((await request(base, "/api/admin/customers")).status, 401);
      assert.equal((await request(base, "/api/admin/customers", "GET", undefined, customerToken)).status, 401);
      assert.equal((await request(base, "/api/admin/customers/" + customer.id, "PATCH", {active: false, expectedActive: true}, customerToken)).status, 401);
    }
    const list = await request(gateway, "/api/admin/customers?q=" + encodeURIComponent(email.toUpperCase()), "GET", undefined, adminToken);
    assert.equal(list.status, 200); assert.equal(list.body.total, 1);
    assert.deepEqual(Object.keys(list.body.items[0]).sort(), ["createdAt", "email", "id", "isActive", "name", "phone"].sort());
    assert.equal(list.body.items[0].id, customer.id); assert.equal(list.body.items[0].isActive, true);
    assert.equal((await request(gateway, "/api/admin/customers/" + admin.id, "PATCH", {active: false, expectedActive: true}, adminToken)).status, 404);
    const endpoint = "/api/admin/customers/" + customer.id;
    assert.equal((await request(gateway, endpoint, "PATCH", {active: false, expectedActive: true}, adminToken)).status, 200);
    assert.equal((await request(gateway, "/api/auth/customer/session", "GET", undefined, customerToken)).status, 401);
    assert.equal(await db.customerSession.count({where: {userId: customer.id}}), 0);
    assert.equal((await request(gateway, "/api/auth/customer/login", "POST", {email, password})).status, 401);
    assert.equal((await request(gateway, endpoint, "PATCH", {active: true, expectedActive: true}, adminToken)).status, 409);
    assert.equal((await request(gateway, endpoint, "PATCH", {active: true, expectedActive: false}, adminToken)).status, 200);
    assert.equal((await request(gateway, "/api/auth/customer/session", "GET", undefined, customerToken)).status, 401);
    assert.equal((await request(gateway, "/api/auth/customer/login", "POST", {email, password})).status, 200);
    const audit = await db.customerStatusAudit.findMany({where: {customerId: customer.id}, orderBy: {createdAt: "asc"}});
    assert.deepEqual(audit.map(row => row.active), [false, true]);
    assert(audit.every(row => row.actorId === admin.id));
  } finally {
    if (customer) await db.customerStatusAudit.deleteMany({where: {customerId: customer.id}});
    if (customer || admin) await db.user.deleteMany({where: {id: {in: [customer?.id, admin?.id].filter(Boolean)}}});
    for (const app of apps.reverse()) await app.close();
    await db.$disconnect();
  }
});
