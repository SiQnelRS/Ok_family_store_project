import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminIdentity } from "@ok-family/shared";

export const ADMIN_COOKIE = "okfamily_admin";
export const gatewayOrigin = () =>
  process.env.API_GATEWAY_URL || "http://127.0.0.1:4000";
export async function adminIdentity(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const response = await fetch(
    new URL("/api/auth/admin/session", gatewayOrigin()),
    {
      headers: { authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    },
  );
  if ([401, 403].includes(response.status)) return null;
  if (!response.ok)
    throw new Error("No pudimos comprobar tu sesión. Intenta nuevamente.");
  return response.json() as Promise<AdminIdentity>;
}
export async function adminRead<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) redirect("/admin/ingresar");
  const response = await fetch(new URL(path, gatewayOrigin()), {
    headers: { authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if ([401, 403].includes(response.status)) redirect("/admin/ingresar");
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Este producto ya no existe."
        : "No pudimos cargar los productos. Intenta nuevamente.",
    );
  return response.json() as Promise<T>;
}
