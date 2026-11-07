import { redirect } from "next/navigation";
import { adminIdentity } from "../../../lib/admin";
import { AdminLoginForm } from "../../../components/admin/login-form";
export default async function LoginPage() {
  const user = await adminIdentity();
  if (user) redirect("/admin");
  return <AdminLoginForm />;
}
