"use client";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { StoreHeader } from "./store-header";
export function StoreFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin"))
    return <main id="contenido">{children}</main>;
  return (
    <>
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
          <a href="/admin">Administrar tienda</a>
        </div>
      </footer>
    </>
  );
}
