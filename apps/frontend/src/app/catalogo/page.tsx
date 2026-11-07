import type { Metadata } from "next";
import { CatalogScreen } from "../../components/catalog-screen";
import { parseFilters } from "../../lib/catalog";
import type { SearchValues } from "../../lib/catalog";

export const metadata: Metadata = { title: "Catálogo de productos y lotes" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  return <CatalogScreen filters={parseFilters(await searchParams)} />;
}
