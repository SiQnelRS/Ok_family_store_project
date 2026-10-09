import Link from "next/link";
import { ProductCard } from "../components/product-card";
import { catalogHref, getCatalog, parseFilters } from "../lib/catalog";
import type { SearchValues } from "../lib/catalog";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const filters = parseFilters(await searchParams);
  const result = await getCatalog(filters);
  const filtered = Boolean(filters.q || filters.category || filters.type);
  const pages = result.ok
    ? Math.ceil(result.data.total / result.data.pageSize)
    : 0;

  return (
    <>
      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star" aria-hidden="true">
              ✳
            </span>{" "}
            HALLAZGOS QUE NO SE REPITEN
          </p>
          <h1 id="hero-title">
            Buenos hallazgos.
            <br />
            <em>Nuevas historias.</em>
          </h1>
          <p className="hero-description">
            Productos y lotes de liquidaciones y devoluciones de Estados Unidos.
            Piezas diferentes, disponibles por tiempo limitado.
          </p>
          <a className="button" href="#catalogo">
            Explorar catálogo <span aria-hidden="true">↗</span>
          </a>
          <p className="hero-caption">Un lugar para descubrir algo especial.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-caption">EL GUSTO DE ENCONTRAR</span>
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-card">
            <span className="art-star">✳</span>
            <span className="art-word">
              oh,
              <br />
              qué buen
              <br />
              <i>hallazgo.</i>
            </span>
            <span className="art-sign">OK FAMILY STORE</span>
          </div>
          <span className="art-stamp">
            PIEZAS ÚNICAS
            <br />
            <b>&</b>
            <br />
            LOTES ESPECIALES
          </span>
          <span className="art-bottom">DE DURANGO, PARA TU FAMILIA.</span>
        </div>
      </section>
      <div className="value-strip">
        <div className="shell">
          <span>
            01 <b>Mercancía seleccionada</b>
          </span>
          <span>
            02 <b>Piezas y lotes</b>
          </span>
          <span>
            03 <b>Disponibilidad limitada</b>
          </span>
        </div>
      </div>
      <section
        id="catalogo"
        className="catalog shell"
        aria-labelledby="catalog-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORA LA TIENDA</p>
            <h2 id="catalog-title">El próximo hallazgo es tuyo.</h2>
          </div>
          {result.ok && (
            <p className="results-count">
              {result.data.total} publicación
              {result.data.total === 1 ? "" : "es"}
            </p>
          )}
        </div>
        <form
          className="filters"
          action="/#catalogo"
          method="get"
          role="search"
        >
          <div className="field search-field">
            <label htmlFor="q">Qué estás buscando</label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Busca ropa, calzado, hogar…"
              maxLength={100}
              defaultValue={filters.q}
            />
          </div>
          <div className="field">
            <label htmlFor="category">Categoría</label>
            <input
              id="category"
              name="category"
              list="categories"
              placeholder="Todas las categorías"
              maxLength={80}
              defaultValue={filters.category}
            />
            <datalist id="categories">
              <option value="Ropa" />
              <option value="Calzado" />
              <option value="Hogar" />
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="type">Tipo de publicación</label>
            <select id="type" name="type" defaultValue={filters.type}>
              <option value="">Productos y lotes</option>
              <option value="PRODUCTO">Productos individuales</option>
              <option value="LOTE">Lotes completos</option>
            </select>
          </div>
          <button className="button filter-button" type="submit">
            Buscar <span aria-hidden="true">↗</span>
          </button>
        </form>
        {filtered && (
          <div className="active-filters">
            <span>Resultados de tu búsqueda</span>
            <Link href="/#catalogo">Limpiar filtros ×</Link>
          </div>
        )}
        {!result.ok ? (
          <div className="empty-state" role="status">
            <span className="empty-symbol" aria-hidden="true">
              ↻
            </span>
            <h3>El catálogo estará de vuelta pronto.</h3>
            <p>
              No pudimos cargar las publicaciones. Intenta nuevamente en un
              momento.
            </p>
            <Link
              className="text-link"
              href={catalogHref(filters, filters.page)}
            >
              Volver a intentar ↗
            </Link>
          </div>
        ) : result.data.items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol" aria-hidden="true">
              ⌕
            </span>
            <h3>
              {filtered
                ? "Todavía no encontramos ese hallazgo."
                : "Pronto habrá nuevos hallazgos."}
            </h3>
            <p>
              {filtered
                ? "Prueba con otro nombre o explora todas las publicaciones."
                : "Vuelve a visitarnos para conocer las próximas publicaciones."}
            </p>
            {(filtered || filters.page > 1) && (
              <Link className="text-link" href="/#catalogo">
                Ver todo el catálogo ↗
              </Link>
            )}
          </div>
        ) : (
          <>
            {result.data.items.some((product) => product.isDemo) && (
              <p className="demo-notice">
                <span>CATÁLOGO DE EJEMPLO</span> Las publicaciones marcadas como
                ejemplo no representan existencias reales.
              </p>
            )}
            <div className="product-grid">
              {result.data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {pages > 1 && (
              <nav className="pagination" aria-label="Páginas del catálogo">
                {filters.page > 1 ? (
                  <Link href={catalogHref(filters, filters.page - 1)}>
                    ← Anterior
                  </Link>
                ) : (
                  <span />
                )}
                <span>
                  Página {filters.page} de {pages}
                </span>
                {filters.page < pages ? (
                  <Link href={catalogHref(filters, filters.page + 1)}>
                    Siguiente →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
        <div className="catalog-note">
          <span aria-hidden="true">✳</span>
          <p>
            Cada hallazgo tiene su momento.
            <br />
            <strong>La disponibilidad puede cambiar.</strong>
          </p>
          <span>Conoce las publicaciones y sus detalles.</span>
        </div>
      </section>
    </>
  );
}
