import type { AdminProduct } from "@ok-family/shared";
export function productPayload(product: AdminProduct) {
  const {
    name,
    description,
    category,
    type,
    piecesPerUnit,
    priceInCents,
    availableQuantity,
    published,
    isDemo,
    images,
    updatedAt,
  } = product;
  return {
    name,
    description,
    category,
    type,
    piecesPerUnit,
    priceInCents,
    availableQuantity,
    published,
    isDemo,
    images,
    updatedAt,
  };
}
export async function adminMutation<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  const response = await fetch("/api/admin/" + path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.message || "No pudimos guardar los cambios. Intenta nuevamente.",
    );
  return result as T;
}
