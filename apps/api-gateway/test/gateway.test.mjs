import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

async function start(t, handler, timeoutMs = 1_000) {
  const upstream = createServer(handler);
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamUrl = "http://127.0.0.1:" + upstream.address().port;
  const app = await createApp({
    catalogUrl: upstreamUrl, authUrl: upstreamUrl, commerceUrl: upstreamUrl, timeoutMs,
  }, { logger: false });
  await app.listen(0, "127.0.0.1");
  t.after(async () => {
    await app.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  });
  return { app, url: await app.getUrl() };
}

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

test("gateway: reenvía filtros y slug codificados al catálogo", async (t) => {
  const paths = [];
  const { url } = await start(t, (request, response) => {
    paths.push(request.url);
    json(response, request.url.startsWith("/api/products?")
      ? { items: [], total: 0, page: 2, pageSize: 6 }
      : { slug: "silla-de-comedor" });
  });
  const response = await fetch(url + "/api/products?q=silla%20%26%20mesa&type=LOTE&category=Hogar&page=2&pageSize=6");
  assert.equal(response.status, 200);
  const params = new URL(paths[0], "http://localhost").searchParams;
  assert.equal(params.get("q"), "silla & mesa");
  assert.equal(params.get("type"), "LOTE");
  assert.equal(params.get("category"), "Hogar");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("pageSize"), "6");
  assert.equal((await (await fetch(url + "/api/products/silla-de-comedor")).json()).slug, "silla-de-comedor");
  assert.equal(paths[1], "/api/products/silla-de-comedor");
});

test("gateway: valida entrada antes de contactar servicios internos", async (t) => {
  let calls = 0;
  const { url } = await start(t, (_request, response) => { calls += 1; json(response, {}); });
  for (const path of ["/api/products?pageSize=999", "/api/products?published=false", "/api/products/INVALID_slug"]) {
    assert.equal((await fetch(url + path)).status, 400);
  }
  assert.equal(calls, 0);
});

test("gateway: conserva 404 y 429 y oculta respuestas internas de error", async (t) => {
  let status = 404;
  const { url } = await start(t, (_request, response) => {
    json(response, { message: "postgres://admin:secret@internal" }, status);
  });
  for (const [upstreamStatus, expectedStatus] of [[404, 404], [429, 429], [500, 503], [503, 503]]) {
    status = upstreamStatus;
    const response = await fetch(url + "/api/products/no-existe");
    assert.equal(response.status, expectedStatus);
    assert.doesNotMatch(await response.text(), /secret|postgres:|internal/);
  }
});

test("gateway: corta esperas largas y responde 504", async (t) => {
  const { url } = await start(t, () => {}, 50);
  const response = await fetch(url + "/api/products");
  assert.equal(response.status, 504);
});

test("gateway: rechaza contenido inválido del servicio", async (t) => {
  const { url } = await start(t, (_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html>Error interno</html>");
  });
  const response = await fetch(url + "/api/products");
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /html/);
});

test("gateway: readiness verifica BD mediante catalog ready y liveness es independiente", async (t) => {
  let catalogAvailable = false;
  const seenPaths = [];
  const { url } = await start(t, (request, response) => {
    seenPaths.push(request.url);
    if (request.url === "/api/ready" && !catalogAvailable) {
      return json(response, { status: "unavailable" }, 503);
    }
    json(response, { status: "ok" });
  });
  const response = await fetch(url + "/api/ready");
  assert.equal(response.status, 503);
  assert.deepEqual((await response.json()).checks, { auth: "ok", catalog: "unavailable", commerce: "ok" });
  assert.ok(seenPaths.includes("/api/ready"));
  assert.equal((await fetch(url + "/api/health")).status, 200);
  catalogAvailable = true;
  const healthyResponse = await fetch(url + "/api/ready");
  assert.equal(healthyResponse.status, 200);
  assert.equal((await healthyResponse.json()).status, "ok");
});

test("gateway: corta también respuestas cuyo cuerpo queda incompleto", async (t) => {
  const { url } = await start(t, (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"items":');
  }, 50);
  assert.equal((await fetch(url + "/api/products")).status, 504);
});

test("gateway: reporta fallos de conexión como 503", async (t) => {
  const { url } = await start(t, (_request, response) => response.destroy());
  assert.equal((await fetch(url + "/api/products")).status, 503);
});