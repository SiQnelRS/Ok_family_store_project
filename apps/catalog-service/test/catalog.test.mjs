import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
import { toProductSummary } from "../dist/repository.js";

const product = {
  id: "product-1", slug: "silla-de-comedor", name: "Silla de comedor",
  description: "Silla de madera.", priceInCents: 65000, currency: "MXN",
  type: "PRODUCTO", category: "Hogar", availableQuantity: 1, piecesPerUnit: 1,
  availability: "DISPONIBLE", images: [], isDemo: false,
};

async function start(repository) {
  const app = await createApp(repository, { logger: false });
  await app.listen(0, "127.0.0.1");
  return { app, url: await app.getUrl() };
}

function repository(overrides = {}) {
  return {
    list: async (query) => ({ items: [product], total: 1, page: query.page, pageSize: query.pageSize }),
    findBySlug: async (slug) => slug === product.slug ? product : null,
    ready: async () => {},
    ...overrides,
  };
}

test("catálogo: filtros validados, valores por defecto y cabeceras de seguridad", async (t) => {
  let receivedQuery;
  const { app, url } = await start(repository({
    list: async (query) => {
      receivedQuery = query;
      return { items: [product], total: 1, page: query.page, pageSize: query.pageSize };
    },
  }));
  t.after(() => app.close());
  const response = await fetch(url + "/api/products?q=%20silla%20&type=PRODUCTO&category=Hogar", {
    headers: { Origin: "http://localhost:3000" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(receivedQuery.q, "silla");
  assert.equal(receivedQuery.type, "PRODUCTO");
  assert.equal(receivedQuery.page, 1);
  assert.equal(receivedQuery.pageSize, 12);
  assert.deepEqual((await response.json()).items, [product]);

  const pageResponse = await fetch(url + "/api/products?page=2&pageSize=6");
  assert.equal(pageResponse.status, 200);
  assert.equal(receivedQuery.page, 2);
  assert.equal(receivedQuery.pageSize, 6);
});

test("catálogo: rechaza parámetros ambiguos, filtros desconocidos y paginación sin límite", async (t) => {
  let calls = 0;
  const { app, url } = await start(repository({
    list: async () => { calls += 1; throw new Error("should never query"); },
  }));
  t.after(() => app.close());
  for (const query of [
    "page=0", "page=-1", "page=1.5", "page=abc", "pageSize=49",
    "page=10001", "type=ADMIN", "published=false", "q=one&q=two",
    "q=" + "a".repeat(101), "category=",
  ]) {
    const response = await fetch(url + "/api/products?" + query);
    assert.equal(response.status, 400, query);
  }
  assert.equal(calls, 0);
});

test("catálogo: detalle, 404, validación de slug y disponibilidad", async (t) => {
  const { app, url } = await start(repository());
  t.after(() => app.close());
  assert.deepEqual(await (await fetch(url + "/api/products/" + product.slug)).json(), product);
  assert.equal((await fetch(url + "/api/products/no-existe")).status, 404);
  assert.equal((await fetch(url + "/api/products/INVALID_slug")).status, 400);
  assert.equal((await fetch(url + "/api/ready")).status, 200);

  const internal = {
    ...product, reservedQuantity: 2, soldQuantity: 0,
    published: true, createdAt: new Date(), updatedAt: new Date(),
  };
  assert.equal(toProductSummary({ ...internal, availableQuantity: 0 }).availability, "RESERVADO");
  assert.equal(toProductSummary({ ...internal, availableQuantity: 0, reservedQuantity: 0 }).availability, "VENDIDO");
  assert.equal(Object.hasOwn(toProductSummary(internal), "reservedQuantity"), false);
});

test("catálogo: caída de persistencia devuelve 503 sin filtrar credenciales y mantiene liveness", async (t) => {
  const fail = async () => { throw new Error("postgres://admin:secret@private-host/database"); };
  const { app, url } = await start(repository({ list: fail, findBySlug: fail, ready: fail }));
  t.after(() => app.close());
  for (const path of ["/api/products", "/api/products/test", "/api/ready"]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /secret|postgres:|private-host/);
  }
  const response = await fetch(url + "/api/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});
