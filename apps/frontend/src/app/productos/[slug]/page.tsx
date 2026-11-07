import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@ok-family/shared";
import {
  AvailabilityBadge,
  ProductMedia,
} from "../../../components/product-card";
import { getProduct } from "../../../lib/catalog";

export const metadata: Metadata = { title: "Detalle de publicación" };

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const result = await getProduct(slug);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return (
      <section className="shell detail-shell">
        <Link className="text-link" href="/catalogo">
          ← Volver al catálogo
        </Link>
        <div className="empty-state" role="status">
          <h1>No pudimos cargar este hallazgo.</h1>
          <p>Intenta nuevamente en un momento.</p>
          <Link className="button" href={"/productos/" + slug}>
            VOLVER A INTENTAR
          </Link>
        </div>
      </section>
    );
  }
  const product = result.data;
  const lot = product.type === "LOTE";
  return (
    <section className="shell detail-shell">
      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <Link href="/">INICIO</Link>
        <span aria-hidden="true">/</span>
        <Link href="/catalogo">CATÁLOGO</Link>
        <span aria-hidden="true">/</span>
        <span>{product.category}</span>
      </nav>
      <div className="product-detail">
        <div
          className={
            "product-gallery" +
            (product.images.length > 1 ? " has-thumbnails" : "")
          }
        >
          <div className="gallery-main">
            <ProductMedia product={product} />
            <span className="gallery-badge">
              {lot
                ? "LOTE · " + product.piecesPerUnit + " PIEZAS"
                : "PRODUCTO INDIVIDUAL"}
            </span>
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbnails">
              {product.images.slice(1).map((photo, index) => (
                <div className="gallery-secondary" key={photo.url + index}>
                  <img
                    src={photo.url}
                    alt={photo.alt || product.name + ", vista " + (index + 2)}
                    width={230}
                    height={344}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow detail-eyebrow">
            {lot
              ? "LOTE COMPLETO · " + product.piecesPerUnit + " PIEZAS"
              : "PRODUCTO INDIVIDUAL"}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-category">{product.category}</p>
          <p className="detail-price">
            {formatMoney(product.priceInCents)}{" "}
            <small>MXN{lot ? " / LOTE" : " / UNIDAD"}</small>
          </p>
          <div className="detail-description">
            <h2>{lot ? "CONTENIDO DEL LOTE" : "DESCRIPCIÓN"}</h2>
            <p>{product.description}</p>
            {lot && (
              <p>
                Se vende el lote completo de {product.piecesPerUnit} piezas.
              </p>
            )}
          </div>
          <dl className="product-facts">
            <div>
              <dt>Unidades disponibles</dt>
              <dd>{product.availableQuantity}</dd>
            </div>
            <div>
              <dt>Piezas por {lot ? "lote" : "unidad"}</dt>
              <dd>{product.piecesPerUnit}</dd>
            </div>
            <div>
              <dt>El precio corresponde a</dt>
              <dd>{lot ? "Un lote completo" : "Una unidad"}</dd>
            </div>
          </dl>
          <AvailabilityBadge product={product} />
          <button
            className="button purchase-unavailable"
            type="button"
            disabled
            aria-describedby="purchase-note"
          >
            COMPRAS EN LÍNEA · PRÓXIMAMENTE
          </button>
          <p className="detail-note" id="purchase-note">
            Por ahora puedes explorar el catálogo. Las compras en línea estarán
            disponibles en una próxima etapa.
          </p>
          {product.isDemo && (
            <p className="demo-notice">
              <strong>PUBLICACIÓN DE EJEMPLO.</strong> Este artículo no
              representa una existencia real.
            </p>
          )}
          <Link className="text-link detail-back" href="/catalogo">
            ← Volver al catálogo
          </Link>
        </div>
      </div>
    </section>
  );
}
