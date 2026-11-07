import { notFound } from "next/navigation";
import { adminRead } from "../../../../../lib/admin";
import type { AdminProduct } from "@ok-family/shared";
import { ProductForm } from "../../../../../components/admin/product-form";
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const product = await adminRead<AdminProduct>("/api/admin/products/" + id);
  return <ProductForm product={product} />;
}
