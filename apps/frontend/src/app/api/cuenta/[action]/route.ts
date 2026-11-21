import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { gatewayOrigin } from "../../../../lib/admin";
export const runtime = "nodejs";
const headers = {"Cache-Control": "no-store"};
const fail = (message: string, status: number) => NextResponse.json({message}, {status, headers});
type Context = {params: Promise<{action: string}>};
export async function POST(request: Request, {params}: Context) {
  const {action} = await params;
  if (!["register", "login", "logout", "profile", "password"].includes(action)) return fail("Operación no disponible.", 404);
  try {
    const origin = new URL(request.headers.get("origin") || "");
    if (origin.host !== request.headers.get("host")?.toLowerCase() || origin.protocol !== new URL(request.url).protocol || !["http:", "https:"].includes(origin.protocol) || request.headers.get("sec-fetch-site") === "cross-site") return fail("No pudimos validar la solicitud.", 403);
  } catch { return fail("No pudimos validar la solicitud.", 403); }
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Formato no válido.", 415);
  const reader = request.body?.getReader(); if (!reader) return fail("Faltan los datos.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4096) { await reader.cancel(); return fail("Datos demasiado grandes.", 413); } chunks.push(part.value); } }
  catch { return fail("No pudimos leer los datos.", 400); } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return fail("Revisa los datos del formulario.", 400); }
  const jar = await cookies(); const token = jar.get("okfamily_customer")?.value;
  if (action === "logout" && !token) return NextResponse.json({ok:true}, {headers});
  if (["profile", "password"].includes(action) && !token) return fail("Tu sesión terminó. Vuelve a ingresar.", 401);
  try {
    const response = await fetch(new URL("/api/auth/customer/" + action, gatewayOrigin()), {
      method: "POST", headers: {"content-type": "application/json", ...(["logout", "profile", "password"].includes(action) && token ? {authorization: "Bearer " + token} : {})},
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
    });
    const result = await response.json() as {token?: string; expiresAt?: string; user?: unknown; message?: string};
    if (action === "logout" && (response.ok || response.status === 401)) {
      jar.set("okfamily_customer", "", {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0});
      return NextResponse.json({ok:true}, {headers});
    }
    if ((action === "password" && response.ok) || (["profile", "password"].includes(action) && response.status === 401)) {
      jar.set("okfamily_customer", "", {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0});
      if (response.ok) return NextResponse.json({ok:true}, {headers});
    }
    if (!response.ok) return fail(response.status >= 500 ? "No pudimos completar la operación. Intenta nuevamente." : typeof result.message === "string" ? result.message : "Revisa los datos del formulario.", response.status);
    if (action === "profile") return NextResponse.json({ok:true}, {headers});
    if (!result.token || !result.expiresAt) return fail("No pudimos iniciar sesión.", 502);
    jar.set("okfamily_customer", result.token, {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: new Date(result.expiresAt)});
    return NextResponse.json({user: result.user}, {headers});
  } catch { return fail("No podemos conectar con la tienda. Intenta nuevamente.", 503); }
}
