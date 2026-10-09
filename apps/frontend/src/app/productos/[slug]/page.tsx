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
        <Link className="text-link" href="/#catalogo">
          ← Volver al catálogo
        </Link>
        <div className="empty-state" role="status">
          <h1>No pudimos cargar este hallazgo.</h1>
          <p>Intenta nuevamente en un momento.</p>
          <Link className="button" href={"/productos/" + slug}>
            Volver a intentar
          </Link>
        </div>
      </section>
    );
  }
  const product = result.data;
  return (
    <section className="shell detail-shell">
      <Link className="text-link" href="/#catalogo">
        ← Volver al catálogo
      </Link>
      <div className="product-detail">
        <ProductMedia product={product} />
        <div className="detail-copy">
          <p className="eyebrow">
            {product.category} ·{" "}
            {product.type === "LOTE" ? "LOTE COMPLETO" : "PRODUCTO INDIVIDUAL"}
          </p>
          <h1>{product.name}</h1>
          <AvailabilityBadge product={product} />
          <p className="detail-price">
            {formatMoney(product.priceInCents)} <small>MXN</small>
          </p>
          <p className="detail-description">{product.description}</p>
          <dl className="product-facts">
            <div>
              <dt>Unidades disponibles</dt>
              <dd>{product.availableQuantity}</dd>
            </div>
            <div>
              <dt>Piezas por {product.type === "LOTE" ? "lote" : "unidad"}</dt>
              <dd>{product.piecesPerUnit}</dd>
            </div>
            <div>
              <dt>El precio corresponde a</dt>
              <dd>
                {product.type === "LOTE" ? "Un lote completo" : "Una unidad"}
              </dd>
            </div>
          </dl>
          {product.isDemo && (
            <p className="demo-notice">
              <span>PUBLICACIÓN DE EJEMPLO</span> Este artículo no representa
              una existencia real.
            </p>
          )}
          <p className="detail-note">
            Por ahora puedes explorar nuestro catálogo. Las compras en línea
            estarán disponibles en una próxima etapa.
          </p>
        </div>
      </div>
    </section>
  );
}
