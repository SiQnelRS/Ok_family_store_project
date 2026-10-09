import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../packages/database/dist/index.js";
import { createApp as createCatalogApp } from "../apps/catalog-service/dist/app.js";
import { createApp as createGatewayApp } from "../apps/api-gateway/dist/app.js";
import { createApp as createAuthApp } from "../apps/auth-service/dist/app.js";
import { createApp as createCommerceApp } from "../apps/commerce-service/dist/app.js";

test("PostgreSQL: restricciones, lote y catálogo HTTP a través del gateway", async () => {
  const db = createDatabaseClient();
  const marker = randomUUID();
  const slug = "integration-" + marker;
  const createdIds = [];
  const apps = [];
  try {
    const product = await db.product.create({ data: {
      slug, name: "Lote de integración " + marker, description: "Fixture temporal",
      priceInCents: 95050, category: "Integración", type: "LOTE", piecesPerUnit: 8,
      availableQuantity: 1, published: true, isDemo: true,
    } });
    createdIds.push(product.id);
    const hidden = await db.product.create({ data: {
      slug: slug + "-hidden", name: "Publicación oculta", description: "Fixture temporal",
      priceInCents: 100, category: "Integración", published: false,
    } });
    createdIds.push(hidden.id);

    await assert.rejects(db.product.update({ where: { id: product.id }, data: { availableQuantity: -1 } }));
    await assert.rejects(db.product.update({ where: { id: product.id }, data: { priceInCents: -1 } }));
    await assert.rejects(db.product.update({ where: { id: product.id }, data: { piecesPerUnit: 0 } }));
    const unchanged = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(unchanged.availableQuantity, 1);
    assert.equal(unchanged.priceInCents, 95050);

    async function listen(app) {
      apps.push(app);
      await app.listen(0, "127.0.0.1");
      return app.getUrl();
    }
    const catalogUrl = await listen(await createCatalogApp(undefined, { logger: false }));
    const authUrl = await listen(await createAuthApp({ logger: false }));
    const commerceUrl = await listen(await createCommerceApp({ logger: false }));
    const gatewayUrl = await listen(await createGatewayApp({ catalogUrl, authUrl, commerceUrl }, { logger: false }));

    const ready = await fetch(gatewayUrl + "/api/ready");
    assert.equal(ready.status, 200);
    const listResponse = await fetch(gatewayUrl + "/api/products?q=" + marker);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.total, 1);
    assert.equal(list.items[0].availableQuantity, 1);
    assert.equal(list.items[0].piecesPerUnit, 8);
    assert.equal(list.items[0].priceInCents, 95050);
    assert.equal(list.items[0].availability, "DISPONIBLE");

    const detail = await fetch(gatewayUrl + "/api/products/" + slug);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).id, product.id);
    assert.equal((await fetch(gatewayUrl + "/api/products/" + hidden.slug)).status, 404);
    assert.equal((await fetch(gatewayUrl + "/api/products?page=-1")).status, 400);
  } finally {
    for (const app of apps.reverse()) await app.close();
    if (createdIds.length) await db.product.deleteMany({ where: { id: { in: createdIds } } });
    await db.$disconnect();
  }
});
