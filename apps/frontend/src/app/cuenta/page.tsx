import type { Metadata } from "next";
import { cookies } from "next/headers";
import { gatewayOrigin } from "../../lib/admin";
import { CustomerAccount } from "../../components/customer-account";
export const metadata: Metadata = {title: "Mi cuenta", robots: {index: false, follow: false}};
export default async function AccountPage({searchParams}: {searchParams: Promise<{password?: string}>}) {
  const params = await searchParams;
  const token = (await cookies()).get("okfamily_customer")?.value;
  let user: {name: string; email: string} | null = null; let unavailable = false;
  if (token) {
    try {
      const response = await fetch(new URL("/api/auth/customer/session", gatewayOrigin()), {headers: {authorization: "Bearer " + token}, cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error"});
      if (response.ok) user = await response.json() as typeof user;
      else if (response.status !== 401 && response.status !== 403) unavailable = true;
    } catch { unavailable = true; }
  }
  return <CustomerAccount user={user} unavailable={unavailable} passwordUpdated={params.password === "actualizada"} />;
}
