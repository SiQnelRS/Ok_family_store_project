import Link from "next/link";
import { formatMoney } from "@ok-family/shared";
import type { ProductSummary } from "@ok-family/shared";

const labels = {
  DISPONIBLE: "Disponible",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido",
};

export function ProductMedia({ product }: { product: ProductSummary }) {
  const photo = product.images[0];
  return (
    <div className={"product-media" + (!photo ? " placeholder" : "")}>
      {photo ? (
        <img
          src={photo.url}
          alt={photo.alt || product.name}
          loading="lazy"
          width={640}
          height={680}
        />
      ) : (
        <>
          <span className="placeholder-category">{product.category}</span>
          <span className="placeholder-note">Fotografía pendiente</span>
        </>
      )}
    </div>
  );
}

export function AvailabilityBadge({ product }: { product: ProductSummary }) {
  return (
    <span
      className={"availability status-" + product.availability.toLowerCase()}
    >
      <span aria-hidden="true">●</span> {labels[product.availability]}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const lot = product.type === "LOTE";
  return (
    <article className="product-card">
      <Link
        className="product-image-link"
        href={"/productos/" + product.slug}
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductMedia product={product} />
      </Link>
      <div className="product-meta">
        <span>
          {lot ? product.piecesPerUnit + " PIEZAS · LOTE" : "PIEZA INDIVIDUAL"}{" "}
          · {product.category}
        </span>
        {product.isDemo && <span className="demo-tag">Ejemplo</span>}
      </div>
      <h3>
        <Link href={"/productos/" + product.slug}>{product.name}</Link>
      </h3>
      <p className="price">
        {formatMoney(product.priceInCents)}{" "}
        <small>MXN / {lot ? "LOTE" : "UNIDAD"}</small>
      </p>
      <div className="product-bottom">
        <AvailabilityBadge product={product} />
        <span className="quantity-note">
          {product.availableQuantity} disponible
          {product.availableQuantity === 1 ? "" : "s"}
        </span>
      </div>
    </article>
  );
}
