import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreHeader } from "../components/store-header";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ok Family Store · Productos y lotes en Durango",
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
        <Suspense fallback={<div className="header-placeholder" />}>
          <StoreHeader />
        </Suspense>
        <main id="contenido">{children}</main>
        <footer id="visitanos" className="site-footer">
          <div className="shell footer-grid">
            <div>
              <img
                src="/figma/ok-family-logo.png"
                width={195}
                height={63}
                alt="Ok Family Store"
                loading="lazy"
              />
              <p>Ropa y más para todos.</p>
            </div>
            <div>
              <h2>VISÍTANOS</h2>
              <address>
                Boulevard de las Rosas 233
                <br />
                Jardines de Durango, Durango
              </address>
            </div>
            <div>
              <h2>HORARIO DE TIENDA</h2>
              <p>12:00 p. m. a 8:30 p. m.</p>
              <p>Productos únicos y lotes completos.</p>
            </div>
          </div>
          <div className="shell footer-bottom">
            <span>OK FAMILY STORE · DURANGO</span>
            <span>La disponibilidad de las publicaciones puede cambiar.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
