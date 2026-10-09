import "server-only";
import type { CatalogResponse, ProductSummary } from "@ok-family/shared";

export type SearchValues = Record<string, string | string[] | undefined>;
export interface CatalogFilters {
  q: string;
  category: string;
  type: string;
  page: number;
}
type ApiResult<T> =
  { ok: true; data: T } | { ok: false; reason: "unavailable" | "not-found" };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseFilters(values: SearchValues): CatalogFilters {
  const page = Number(first(values.page));
  const type = first(values.type);
  return {
    q: first(values.q).slice(0, 100),
    category: first(values.category).slice(0, 80),
    type: type === "LOTE" || type === "PRODUCTO" ? type : "",
    page: Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1,
  };
}

export function catalogHref(filters: CatalogFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.type) query.set("type", filters.type);
  if (page > 1) query.set("page", String(page));
  return "/?" + query.toString() + "#catalogo";
}

async function readApi<T>(path: string): Promise<ApiResult<T>> {
  try {
    const base = process.env.API_GATEWAY_URL || "http://127.0.0.1:4000";
    const response = await fetch(new URL(path, base), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function getCatalog(
  filters: CatalogFilters,
): Promise<ApiResult<CatalogResponse>> {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: "12",
  });
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.type) query.set("type", filters.type);
  return readApi<CatalogResponse>("/api/products?" + query);
}

export function getProduct(slug: string): Promise<ApiResult<ProductSummary>> {
  return readApi<ProductSummary>("/api/products/" + encodeURIComponent(slug));
}
