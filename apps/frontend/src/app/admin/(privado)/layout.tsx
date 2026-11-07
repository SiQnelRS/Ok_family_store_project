import { redirect } from "next/navigation";
import { adminIdentity } from "../../../lib/admin";
import { AdminShell } from "../../../components/admin/admin-shell";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await adminIdentity();
  if (!user) redirect("/admin/ingresar");
  return <AdminShell user={user}>{children}</AdminShell>;
}
