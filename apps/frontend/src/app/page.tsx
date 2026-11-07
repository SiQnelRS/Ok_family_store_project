import Link from "next/link";
import { Hero } from "../components/hero";
import { ProductCard } from "../components/product-card";
import { CatalogScreen } from "../components/catalog-screen";
import { getCatalog, parseFilters } from "../lib/catalog";
import type { SearchValues } from "../lib/catalog";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const values = await searchParams;
  const filters = parseFilters(values);
  // Mantiene los enlaces existentes de búsqueda y paginación en la raíz.
  if (
    ["q", "category", "type", "page"].some((key) => values[key] !== undefined)
  ) {
    return <CatalogScreen filters={filters} basePath="/" />;
  }
  const result = await getCatalog(filters);
  return (
    <>
      <Hero />
      <section
        className="featured shell"
        id="catalogo"
        aria-labelledby="featured-title"
      >
        <div className="section-heading">
          <h2 id="featured-title">PRODUCTOS Y LOTES DESTACADOS</h2>
          <Link href="/catalogo">
            VER TODOS <span aria-hidden="true">→</span>
          </Link>
        </div>
        {!result.ok ? (
          <div className="empty-state" role="status">
            <h2>El catálogo estará de vuelta pronto.</h2>
            <p>
              No pudimos cargar las publicaciones. Intenta nuevamente en un
              momento.
            </p>
            <Link className="button button-secondary" href="/#catalogo">
              VOLVER A INTENTAR
            </Link>
          </div>
        ) : result.data.items.length === 0 ? (
          <div className="empty-state">
            <h2>Pronto habrá nuevos hallazgos.</h2>
            <p>Vuelve a visitarnos para conocer las próximas publicaciones.</p>
          </div>
        ) : (
          <>
            {result.data.items.some((p) => p.isDemo) && (
              <p className="featured-caption">
                PUBLICACIONES DE EJEMPLO · NO REPRESENTAN EXISTENCIAS REALES
              </p>
            )}
            <div className="product-grid featured-grid">
              {result.data.items.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
