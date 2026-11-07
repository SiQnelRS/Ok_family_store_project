import Link from "next/link";
import { ProductCard } from "./product-card";
import { CatalogFiltersPanel } from "./catalog-filters";
import { catalogHref, getCatalog } from "../lib/catalog";
import type { CatalogFilters } from "../lib/catalog";

export async function CatalogScreen({
  filters,
  basePath = "/catalogo",
}: {
  filters: CatalogFilters;
  basePath?: string;
}) {
  const result = await getCatalog(filters);
  const filtered = Boolean(filters.q || filters.category || filters.type);
  const pages = result.ok
    ? Math.ceil(result.data.total / result.data.pageSize)
    : 0;
  const href = (page: number) => basePath + catalogHref(filters, page).slice(1);
  return (
    <section
      className="catalog shell"
      id="catalogo"
      aria-labelledby="catalog-title"
    >
      <div className="catalog-heading">
        <h1 id="catalog-title">
          {filters.type === "LOTE"
            ? "LOTES AL MAYOREO"
            : filters.type === "PRODUCTO"
              ? "PRODUCTOS INDIVIDUALES"
              : "PRODUCTOS Y LOTES"}
        </h1>
        <p>
          {filters.type === "LOTE"
            ? "Compra lotes completos para surtir tu negocio."
            : "Prendas únicas y lotes de liquidación. Encuentra tu próximo hallazgo."}
        </p>
      </div>
      <div className="catalog-layout">
        <CatalogFiltersPanel
          key={[filters.q, filters.category, filters.type].join("|")}
          filters={filters}
          action={basePath}
        />
        <div className="catalog-results">
          <div className="results-toolbar">
            <p>
              {result.ok ? result.data.total + " PUBLICACIONES" : "CATÁLOGO"}
              {result.ok && result.data.items.some((p) => p.isDemo) && (
                <span> · DATOS DE EJEMPLO</span>
              )}
            </p>
            <span className="sort-label">MÁS RECIENTES</span>
          </div>
          {filtered && (
            <div className="active-filters">
              <span>
                {[
                  filters.q,
                  filters.category,
                  filters.type === "LOTE"
                    ? "Lotes"
                    : filters.type === "PRODUCTO"
                      ? "Productos"
                      : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Link href={basePath + "#catalogo"}>Limpiar ×</Link>
            </div>
          )}
          {!result.ok ? (
            <div className="empty-state" role="status">
              <h2>El catálogo estará de vuelta pronto.</h2>
              <p>
                No pudimos cargar las publicaciones. Intenta nuevamente en un
                momento.
              </p>
              <Link
                className="button button-secondary"
                href={href(filters.page)}
              >
                VOLVER A INTENTAR
              </Link>
            </div>
          ) : result.data.items.length === 0 ? (
            <div className="empty-state">
              <h2>
                {filtered
                  ? "Todavía no encontramos ese hallazgo."
                  : "Pronto habrá nuevos hallazgos."}
              </h2>
              <p>
                {filtered
                  ? "Prueba otra búsqueda o explora todas las publicaciones."
                  : "Vuelve a visitarnos para descubrir las próximas publicaciones."}
              </p>
              {(filtered || filters.page > 1) && (
                <Link className="button button-secondary" href={basePath}>
                  VER TODO EL CATÁLOGO
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="product-grid">
                {result.data.items.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
              {pages > 1 && (
                <nav className="pagination" aria-label="Páginas del catálogo">
                  {filters.page > 1 ? (
                    <Link href={href(filters.page - 1)}>← Anterior</Link>
                  ) : (
                    <span />
                  )}
                  <span>
                    Página {filters.page} de {pages}
                  </span>
                  {filters.page < pages ? (
                    <Link href={href(filters.page + 1)}>Siguiente →</Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
              {result.data.items.some((p) => p.isDemo) && (
                <p className="demo-notice">
                  Las publicaciones marcadas como ejemplo no representan
                  existencias reales.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
