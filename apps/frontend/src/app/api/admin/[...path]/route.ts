import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, gatewayOrigin } from "../../../../lib/admin";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const error = (message: string, status: number) =>
  NextResponse.json({ message }, { status, headers: noStore });
type Context = { params: Promise<{ path: string[] }> };
async function boundedBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Faltan los datos del formulario.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.length;
      if (bytes > 6000000) {
        await reader.cancel();
        throw new Error("La foto es demasiado grande. El máximo es 4 MB.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  const joined = path.join("/");
  const method = request.method;
  const routes =
    joined === "login" && method === "POST"
      ? "/api/auth/admin/login"
      : /^orders\/[a-f0-9-]{36}$/.test(joined) && method === "PATCH" ? "/api/admin/" + joined
      : joined === "logout" && method === "POST"
        ? "/api/auth/admin/logout"
        : joined === "customers" && method === "GET"
          ? "/api/admin/customers"
          : /^customers\/[a-f0-9-]{36}$/.test(joined) && method === "PATCH"
            ? "/api/admin/" + joined
        : joined === "images" && method === "POST"
          ? "/api/admin/images"
          : joined === "products" && ["GET", "POST"].includes(method)
            ? "/api/admin/products"
            : /^products\/[a-f0-9-]{36}$/.test(joined) &&
                ["GET", "PATCH", "DELETE"].includes(method)
              ? "/api/admin/" + joined
              : null;
  if (!routes) return error("Operación no disponible.", 404);
  if (method !== "GET") {
    let sameOrigin = false;
    try {
      const origin = new URL(request.headers.get("origin") || "");
      // Next puede normalizar request.url a localhost; Host conserva el dominio usado por el navegador.
      sameOrigin =
        origin.host === request.headers.get("host")?.toLowerCase() &&
        origin.protocol === new URL(request.url).protocol &&
        ["http:", "https:"].includes(origin.protocol);
    } catch {
      /* Un Origin ausente o invalido no autoriza escrituras. */
    }
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site")
      return error("No pudimos validar la solicitud. Recarga la página.", 403);
  }
  if (
    method !== "GET" &&
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return error("Formato de solicitud no válido.", 415);
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (joined !== "login" && !token)
    return error("Tu sesión terminó. Vuelve a ingresar.", 401);
  let body: unknown;
  if (method !== "GET") {
    try {
      body = await boundedBody(request);
    } catch (cause) {
      return error(
        cause instanceof Error && cause.message.startsWith("La foto")
          ? cause.message
          : "Revisa los datos del formulario.",
        400,
      );
    }
  }
  let response: Response,
    value: {
      token?: string;
      expiresAt?: string;
      message?: string;
      user?: unknown;
    };
  try {
    const query = method === "GET" ? new URL(request.url).search : "";
    response = await fetch(new URL(routes + query, gatewayOrigin()), {
      method,
      headers: {
        "content-type": "application/json",
        ...(token && joined !== "login"
          ? { authorization: "Bearer " + token }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    value = (await response.json()) as typeof value;
  } catch {
    return error(
      "No podemos conectar con la tienda. Intenta nuevamente en un momento.",
      503,
    );
  }
  if (joined === "logout" && (response.ok || response.status === 401)) {
    jar.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return NextResponse.json({ ok: true }, { headers: noStore });
  }
  if (!response.ok)
    return error(
      response.status >= 500
        ? "No pudimos completar la operación. Intenta nuevamente."
        : typeof value.message === "string"
          ? value.message
          : "Revisa los datos e intenta nuevamente.",
      response.status,
    );
  if (joined === "login") {
    if (!value.token || !value.expiresAt)
      return error("No pudimos iniciar sesión.", 502);
    jar.set(ADMIN_COOKIE, value.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(value.expiresAt),
    });
    return NextResponse.json({ user: value.user }, { headers: noStore });
  }
  return NextResponse.json(value, {
    status: response.status,
    headers: noStore,
  });
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
