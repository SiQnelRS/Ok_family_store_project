import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ok Family Store · Hallazgos únicos en Durango",
    template: "%s | Ok Family Store",
  },
  description:
    "Explora productos y lotes de disponibilidad limitada de Ok Family Store, en Jardines de Durango.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <div className="topbar">
          De Estados Unidos a Durango. Encuentra algo para ti.
        </div>
        <header className="site-header shell">
          <Link className="brand" href="/" aria-label="Ok Family Store, inicio">
            <span className="brand-symbol">
              ok<span>✳</span>
            </span>
            <span className="brand-name">
              OK FAMILY<span>STORE · DURANGO</span>
            </span>
          </Link>
          <nav aria-label="Navegación principal">
            <Link href="/#catalogo">Catálogo</Link>
            <Link href="/?type=LOTE#catalogo">Lotes</Link>
            <a className="visit-link" href="#visitanos">
              Visítanos <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </header>
        <main id="contenido">{children}</main>
        <footer id="visitanos" className="site-footer">
          <div className="shell footer-grid">
            <div>
              <p className="eyebrow">TE ESPERAMOS EN TIENDA</p>
              <h2>
                Ven a encontrar
                <br />
                tu próximo hallazgo.
              </h2>
            </div>
            <div>
              <h3>Dónde estamos</h3>
              <address>
                Boulevard de las Rosas 233
                <br />
                Jardines de Durango, Durango
              </address>
            </div>
            <div>
              <h3>Nuestro horario</h3>
              <p>12:00 p. m. a 8:30 p. m.</p>
              <p className="footer-note">
                Productos únicos. Nuevas posibilidades.
              </p>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>OK FAMILY STORE</span>
            <span>Hecho para encontrar algo especial.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
