import Link from "next/link";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">OK FAMILY · VENTA DE LOTES</p>
          <h1 id="hero-title">
            <span className="desktop-only">
              SURTE TU
              <br />
              NEGOCIO.
            </span>
            <span className="mobile-only">
              TU NEGOCIO
              <br />
              EMPIEZA AQUÍ.
            </span>
          </h1>
          <p className="hero-description">
            <span className="desktop-only">
              Moda de liquidación al mayoreo para emprendedores y revendedores.
            </span>
            <span className="mobile-only">
              Lotes de ropa al mayoreo para emprendedores y revendedores.
            </span>
          </p>
          <p className="hero-caption">
            <span className="desktop-only">
              Compra lotes completos, descubre variedad y haz crecer tu
              inventario.
            </span>
            <span className="mobile-only">
              Surtido variado, una compra por lote.
            </span>
          </p>
          <Link className="button hero-button" href="/catalogo?type=LOTE">
            <span className="desktop-only">EXPLORAR LOTES</span>
            <span className="mobile-only">VER LOTES DISPONIBLES</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Ilustración de prendas de un lote de ropa"
        >
          <div className="hero-scene hero-scene-desktop" aria-hidden="true">
            {[1, 2, 3, 4, 1, 2, 3].map((color, index) => (
              <img
                key={index}
                src={"/figma/hero-desktop-" + color + ".svg"}
                alt=""
                style={{
                  left: 45.5 + index * 70,
                  top: 78.24 + (index % 2) * 14,
                }}
              />
            ))}
            <span className="hero-art-label">
              18 PIEZAS · INVIERNO · TALLA CH
            </span>
          </div>
          <div className="hero-scene hero-scene-mobile" aria-hidden="true">
            {[1, 2, 3, 4, 1, 2].map((color, index) => (
              <img
                key={index}
                src={"/figma/hero-mobile-" + color + ".svg"}
                alt=""
                style={{ left: 22.05 + index * 49, top: 28.9 }}
              />
            ))}
            <span className="hero-art-label">
              LOTES DE LIQUIDACIÓN · MAYOREO
            </span>
          </div>
          <span className="sr-only">
            Ilustración editorial del mockup; no representa una publicación
            disponible.
          </span>
        </div>
      </div>
    </section>
  );
}
