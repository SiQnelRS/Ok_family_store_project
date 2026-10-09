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
  if (photo)
    return (
      <div className="product-media">
        <img
          src={photo.url}
          alt={photo.alt || product.name}
          loading="lazy"
          width={640}
          height={480}
        />
      </div>
    );
  return (
    <div
      className={
        "product-media placeholder tone-" +
        (product.type === "LOTE"
          ? "sand"
          : product.category === "Hogar"
            ? "rose"
            : "sage")
      }
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m24 7 16 9v18l-16 9-16-9V16L24 7Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="m8 16 16 9 16-9M24 25v18M16 11.5l16 9v8"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
      <span className="placeholder-category">{product.category}</span>
      <span className="placeholder-note">Fotografía pendiente</span>
    </div>
  );
}

export function AvailabilityBadge({ product }: { product: ProductSummary }) {
  return (
    <span
      className={
        "availability " +
        (product.availability === "DISPONIBLE" ? "available" : "")
      }
    >
      <span aria-hidden="true">●</span> {labels[product.availability]}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="product-card">
      <Link
        className="product-image-link"
        href={"/productos/" + product.slug}
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductMedia product={product} />
        <span className="type-tag">
          {product.type === "LOTE"
            ? "Lote · " + product.piecesPerUnit + " piezas"
            : "Pieza individual"}
        </span>
      </Link>
      <div className="product-meta">
        <span>{product.category}</span>
        {product.isDemo && <span className="demo-tag">Ejemplo</span>}
      </div>
      <h3>
        <Link href={"/productos/" + product.slug}>{product.name}</Link>
      </h3>
      <div className="product-bottom">
        <p className="price">
          {formatMoney(product.priceInCents)} <small>MXN</small>
        </p>
        <AvailabilityBadge product={product} />
      </div>
      <p className="quantity-note">
        {product.type === "LOTE"
          ? "Precio por lote completo"
          : "Precio por unidad"}{" "}
        · {product.availableQuantity} disponible
        {product.availableQuantity === 1 ? "" : "s"}
      </p>
    </article>
  );
}
