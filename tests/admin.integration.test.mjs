import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { mkdir, unlink, rmdir } from "node:fs/promises";
import sharp from "sharp";
import { createDatabaseClient } from "../packages/database/dist/index.js";
import {
  hashPassword,
  sessionHash,
} from "../packages/service-kit/dist/index.js";
import { createApp as authApp } from "../apps/auth-service/dist/app.js";
import { createApp as catalogApp } from "../apps/catalog-service/dist/app.js";
import { createApp as gatewayApp } from "../apps/api-gateway/dist/app.js";

test("administración: autenticación, permisos, CRUD, fotos, conflictos e historial con PostgreSQL", async (t) => {
  const db = createDatabaseClient();
  const marker = randomUUID();
  const apps = [];
  const ids = [];
  const files = [];
  const directory = resolve(".data", "admin-test-" + marker);
  const previousAuth = process.env.AUTH_SERVICE_URL,
    previousUploads = process.env.CATALOG_UPLOAD_DIR;
  const password = "Prueba-" + randomUUID();
  let authUrl, catalogUrl, gatewayUrl, token, owner, customer, product;
  async function listen(app) {
    apps.push(app);
    await app.listen(0, "127.0.0.1");
    return app.getUrl();
  }
  async function json(base, path, method = "GET", body, access = token) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(access ? { authorization: "Bearer " + access } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const payload = {
    name: "Producto temporal " + marker,
    description: "Solo para verificar la administración.",
    category: "Pruebas",
    type: "LOTE",
    piecesPerUnit: 8,
    priceInCents: 95050,
    availableQuantity: 1,
    published: false,
    isDemo: true,
    images: [],
  };
  try {
    const passwordHash = await hashPassword(password);
    owner = await db.user.create({
      data: {
        email: "admin-" + marker + "@example.test",
        name: "Administrador de prueba",
        passwordHash,
        role: "ADMIN",
      },
    });
    ids.push(owner.id);
    customer = await db.user.create({
      data: {
        email: "cliente-" + marker + "@example.test",
        name: "Cliente de prueba",
        passwordHash,
        role: "CUSTOMER",
      },
    });
    ids.push(customer.id);
    authUrl = await listen(await authApp({ logger: false }));
    process.env.AUTH_SERVICE_URL = authUrl;
    process.env.CATALOG_UPLOAD_DIR = directory;
    await mkdir(directory, { recursive: true });
    catalogUrl = await listen(await catalogApp(undefined, { logger: false }));
    gatewayUrl = await listen(
      await gatewayApp(
        { authUrl, catalogUrl, commerceUrl: authUrl },
        { logger: false },
      ),
    );
    await t.test(
      "rechaza anónimos, contraseñas incorrectas y cuentas de clientes",
      async () => {
        for (const base of [catalogUrl, gatewayUrl])
          assert.equal(
            (await json(base, "/api/admin/products", "GET", undefined, null))
              .status,
            401,
          );
        assert.equal(
          (
            await json(
              gatewayUrl,
              "/api/auth/admin/login",
              "POST",
              { email: owner.email, password: "incorrecta" },
              null,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await json(
              gatewayUrl,
              "/api/auth/admin/login",
              "POST",
              { email: customer.email, password },
              null,
            )
          ).status,
          401,
        );
        const login = await json(
          gatewayUrl,
          "/api/auth/admin/login",
          "POST",
          { email: owner.email, password },
          null,
        );
        assert.equal(login.status, 200);
        token = login.body.token;
        assert(token);
        const saved = await db.adminSession.findUniqueOrThrow({
          where: { tokenHash: sessionHash(token) },
        });
        assert.notEqual(saved.tokenHash, token);
      },
    );
    await t.test("crea un borrador y registra quién lo creó", async () => {
      const created = await json(
        gatewayUrl,
        "/api/admin/products",
        "POST",
        payload,
      );
      assert.equal(created.status, 201);
      product = created.body;
      assert.equal(
        (await json(gatewayUrl, "/api/products/" + product.slug)).status,
        404,
      );
      const list = await json(
        gatewayUrl,
        "/api/admin/products?status=draft&q=" + marker,
      );
      assert.equal(list.body.total, 1);
      assert.equal(
        await db.productAudit.count({
          where: { productId: product.id, actorId: owner.id, action: "CREATE" },
        }),
        1,
      );
    });
    await t.test(
      "valida valores e impide publicar sin fotografía",
      async () => {
        for (const invalid of [
          { priceInCents: -1 },
          { availableQuantity: -1 },
          { piecesPerUnit: 0 },
          { type: "PRODUCTO", piecesPerUnit: 8 },
          { published: true },
          { images: [{ url: "javascript:alert(1)", alt: "Mala" }] },
        ]) {
          const result = await json(
            gatewayUrl,
            "/api/admin/products/" + product.id,
            "PATCH",
            { ...payload, updatedAt: product.updatedAt, ...invalid },
          );
          assert.equal(result.status, 400, JSON.stringify(invalid));
        }
        assert.equal(
          (await json(gatewayUrl, "/api/admin/products?published=false"))
            .status,
          400,
        );
      },
    );
    await t.test(
      "valida y almacena fotografías, publica y conserva centavos y unidades",
      async () => {
        assert.equal(
          (
            await json(gatewayUrl, "/api/admin/images", "POST", {
              contentType: "image/png",
              data: Buffer.from("<svg/>").toString("base64"),
            })
          ).status,
          400,
        );
        const png = await sharp({
          create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
        })
          .png()
          .toBuffer();
        const upload = await json(gatewayUrl, "/api/admin/images", "POST", {
          contentType: "image/png",
          data: png.toString("base64"),
        });
        assert.equal(upload.status, 201);
        files.push(upload.body.url.split("/").at(-1));
        payload.images = [{ ...upload.body, alt: "Foto temporal" }];
        const photo = await fetch(gatewayUrl + upload.body.url);
        assert.equal(photo.status, 200);
        assert.equal(photo.headers.get("content-type"), "image/webp");
        assert((await photo.arrayBuffer()).byteLength > 0);
        const result = await json(
          gatewayUrl,
          "/api/admin/products/" + product.id,
          "PATCH",
          { ...payload, published: true, updatedAt: product.updatedAt },
        );
        assert.equal(result.status, 200);
        product = result.body;
        const published = await json(
          gatewayUrl,
          "/api/products/" + product.slug,
        );
        assert.equal(published.status, 200);
        assert.equal(published.body.priceInCents, 95050);
        assert.equal(published.body.piecesPerUnit, 8);
        assert.equal(published.body.availableQuantity, 1);
      },
    );
    await t.test(
      "detecta ediciones simultáneas y ocultar retira también el detalle público",
      async () => {
        const old = product.updatedAt;
        const updated = await json(
          gatewayUrl,
          "/api/admin/products/" + product.id,
          "PATCH",
          { ...payload, published: false, updatedAt: old },
        );
        assert.equal(updated.status, 200);
        product = updated.body;
        assert.equal(
          (
            await json(
              gatewayUrl,
              "/api/admin/products/" + product.id,
              "PATCH",
              { ...payload, published: true, updatedAt: old },
            )
          ).status,
          409,
        );
        assert.equal(
          (await json(gatewayUrl, "/api/products/" + product.slug)).status,
          404,
        );
        assert.equal(
          (await json(gatewayUrl, "/api/products?q=" + marker)).body.total,
          0,
        );
      },
    );
    await t.test(
      "comprueba el rol en cada solicitud y protege movimientos",
      async () => {
        await db.user.update({
          where: { id: owner.id },
          data: { role: "CUSTOMER" },
        });
        assert.equal(
          (await json(catalogUrl, "/api/admin/products")).status,
          403,
        );
        await db.user.update({
          where: { id: owner.id },
          data: { role: "ADMIN" },
        });
        await db.product.update({
          where: { id: product.id },
          data: { reservedQuantity: 1 },
        });
        assert.equal(
          (
            await json(
              gatewayUrl,
              "/api/admin/products/" + product.id,
              "DELETE",
              { updatedAt: product.updatedAt },
            )
          ).status,
          409,
        );
        await db.product.update({
          where: { id: product.id },
          data: { reservedQuantity: 0 },
        });
        product = (await json(gatewayUrl, "/api/admin/products/" + product.id))
          .body;
      },
    );
    await t.test("elimina el producto y conserva su historial", async () => {
      assert.equal(
        (
          await json(
            gatewayUrl,
            "/api/admin/products/" + product.id,
            "DELETE",
            { updatedAt: product.updatedAt },
          )
        ).status,
        200,
      );
      assert.equal(
        (await json(gatewayUrl, "/api/admin/products/" + product.id)).status,
        404,
      );
      assert.equal(
        await db.productAudit.count({
          where: { productId: product.id, action: "DELETE" },
        }),
        1,
      );
      assert.equal(
        await db.productImage.count({ where: { productId: product.id } }),
        0,
      );
    });
    await t.test(
      "las sesiones vencen y cerrar sesión revoca el acceso",
      async () => {
        await db.adminSession.update({
          where: { tokenHash: sessionHash(token) },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal(
          (await json(gatewayUrl, "/api/admin/products")).status,
          401,
        );
        const login = await json(
          gatewayUrl,
          "/api/auth/admin/login",
          "POST",
          { email: owner.email, password },
          null,
        );
        assert.equal(login.status, 200);
        token = login.body.token;
        assert.equal(
          (await json(gatewayUrl, "/api/auth/admin/logout", "POST", {})).status,
          200,
        );
        assert.equal(
          (await json(catalogUrl, "/api/admin/products")).status,
          401,
        );
      },
    );
  } finally {
    for (const app of apps.reverse()) await app.close();
    if (product?.id) await db.product.deleteMany({ where: { id: product.id } });
    if (owner?.id)
      await db.productAudit.deleteMany({ where: { actorId: owner.id } });
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    for (const file of files)
      await unlink(join(directory, file)).catch(() => {});
    await rmdir(directory).catch(() => {});
    if (previousAuth === undefined) delete process.env.AUTH_SERVICE_URL;
    else process.env.AUTH_SERVICE_URL = previousAuth;
    if (previousUploads === undefined) delete process.env.CATALOG_UPLOAD_DIR;
    else process.env.CATALOG_UPLOAD_DIR = previousUploads;
  }
});
