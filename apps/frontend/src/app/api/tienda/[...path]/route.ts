import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { gatewayOrigin } from "../../../../lib/admin";
export const runtime = "nodejs";
const headers = {"Cache-Control": "no-store"};
const fail = (message: string, status: number) => NextResponse.json({message}, {status, headers});
type Context = {params: Promise<{path: string[]}>};
async function handle(request: Request, {params}: Context) {
  const path = (await params).path.join("/"), method = request.method;
  const valid = (path === "orders" && ["GET","POST"].includes(method)) || (/^orders\/[a-f0-9-]{36}\/(?:cancel|pay)$/.test(path) && method === "POST") || (path === "cart" && ["GET","POST"].includes(method)) || (/^cart\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && method === "DELETE") || (path === "addresses" && ["GET","POST"].includes(method)) || (/^addresses\/[a-f0-9-]{36}$/.test(path) && ["PATCH","DELETE"].includes(method)) || (/^addresses\/[a-f0-9-]{36}\/(?:coverage|quote)$/.test(path) && method === "GET") || (path === "pickup/quote" && method === "GET");
  if (!valid) return fail("Operación no disponible.", 404);
  if (method !== "GET") {
    try { const origin = new URL(request.headers.get("origin") || ""); if (origin.host !== request.headers.get("host")?.toLowerCase() || origin.protocol !== new URL(request.url).protocol || !["http:", "https:"].includes(origin.protocol) || request.headers.get("sec-fetch-site") === "cross-site") return fail("No pudimos validar la solicitud.", 403); }
    catch { return fail("No pudimos validar la solicitud.", 403); }
  }
  const token = (await cookies()).get("okfamily_customer")?.value;
  if (!token) return fail("Inicia sesión para continuar.", 401);
  let body: string | undefined;
  if (["POST","PATCH"].includes(method)) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Formato no válido.", 415);
    const reader = request.body?.getReader(); if (!reader) return fail("Faltan los datos.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4096) { await reader.cancel(); return fail("Datos demasiado grandes.", 413); } chunks.push(part.value); } } catch { return fail("No pudimos leer los datos.", 400); } finally { reader.releaseLock(); }
    body = Buffer.concat(chunks).toString("utf8");
    try { JSON.parse(body); } catch { return fail("Revisa los datos.", 400); }
  }
  try {
    const response = await fetch(new URL("/api/shop/" + path, gatewayOrigin()), {method, headers: {"content-type": "application/json", authorization: "Bearer " + token}, body, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error"});
    const value = await response.json();
    if (!response.ok) return fail(response.status >= 500 ? "No pudimos completar la operación. Intenta nuevamente." : typeof value.message === "string" ? value.message : "Revisa los datos.", response.status);
    return NextResponse.json(value, {status: response.status, headers});
  } catch { return fail("No podemos conectar con la tienda.", 503); }
}
export {handle as GET, handle as POST, handle as PATCH, handle as DELETE};
