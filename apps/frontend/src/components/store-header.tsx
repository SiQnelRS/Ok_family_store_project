"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function StoreHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const exploring = pathname !== "/" || params.size > 0;

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  function closePanels() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <>
      <div className="topbar">
        <span className="desktop-only">
          OK FAMILY MAYOREO · LOTES PARA EMPRENDEDORES · DURANGO
        </span>
        <span className="mobile-only">
          OK FAMILY MAYOREO · LOTES PARA NEGOCIOS
        </span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <nav className="desktop-navigation" aria-label="Navegación principal">
            <Link href="/catalogo">CATÁLOGO</Link>
            <Link href="/catalogo?type=LOTE">LOTES DE ROPA</Link>
            <Link href="/catalogo#filtros">CATEGORÍAS</Link>
            <a href="#visitanos">VISÍTANOS</a>
          </nav>
          <button
            ref={menuButton}
            className="icon-button menu-toggle"
            type="button"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setMenuOpen(!menuOpen);
              setSearchOpen(false);
            }}
          >
            ≡
          </button>
          <Link
            className="brand"
            href="/"
            aria-label="Ok Family Store, inicio"
            onClick={closePanels}
          >
            <img
              src="/figma/ok-family-logo.png"
              width={215}
              height={69}
              alt="Ok Family · Ropa y más para todos"
              fetchPriority="high"
            />
          </Link>
          <div className="header-actions">
            <button
              ref={searchButton}
              className="header-search"
              type="button"
              aria-label={searchOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
              aria-expanded={searchOpen}
              aria-controls="header-search-panel"
              onClick={() => {
                setSearchOpen(!searchOpen);
                setMenuOpen(false);
              }}
            >
              <span className="desktop-only">BUSCAR</span>
              <span className="search-glyph" aria-hidden="true">
                ⌕
              </span>
            </button>
            <button
              className="future-action desktop-only"
              type="button"
              disabled
              title="Mi cuenta estará disponible próximamente"
            >
              MI CUENTA
            </button>
            <button
              className="future-action"
              type="button"
              disabled
              aria-label="Bolsa de lotes, próximamente"
              title="Las compras en línea estarán disponibles próximamente"
            >
              <span className="desktop-only">BOLSA DE LOTES</span>
              <span className="mobile-only bag-glyph" aria-hidden="true">
                ♧
              </span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            className="mobile-menu"
            id="mobile-menu"
            aria-label="Menú móvil"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            <Link href="/" onClick={closePanels}>
              Inicio
            </Link>
            <Link href="/catalogo" onClick={closePanels}>
              Explorar el catálogo
            </Link>
            <Link href="/catalogo?type=LOTE" onClick={closePanels}>
              Lotes completos
            </Link>
            <Link href="/catalogo?type=PRODUCTO" onClick={closePanels}>
              Productos individuales
            </Link>
            <a href="#visitanos" onClick={closePanels}>
              Visítanos en Durango
            </a>
          </nav>
        )}
        {searchOpen && (
          <div
            className="header-search-panel shell"
            id="header-search-panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchOpen(false);
                searchButton.current?.focus();
              }
            }}
          >
            <form
              action="/catalogo"
              method="get"
              role="search"
              onSubmit={closePanels}
            >
              <label className="sr-only" htmlFor="header-query">
                Buscar publicaciones
              </label>
              <input
                ref={searchInput}
                id="header-query"
                name="q"
                type="search"
                maxLength={100}
                defaultValue={params.get("q") ?? ""}
                placeholder="Buscar productos, lotes o categorías"
              />
              <button type="submit" className="button">
                BUSCAR <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>
        )}
      </header>
      <nav className="mobile-tabbar" aria-label="Navegación inferior">
        <Link
          href="/"
          aria-current={!exploring ? "page" : undefined}
          onClick={closePanels}
        >
          <span aria-hidden="true">⌂</span>Inicio
        </Link>
        <Link
          href="/catalogo"
          aria-current={exploring ? "page" : undefined}
          onClick={closePanels}
        >
          <span aria-hidden="true">▦</span>Explorar
        </Link>
        <button
          type="button"
          disabled
          title="Próximamente"
          aria-label="Cuenta, próximamente"
        >
          <span aria-hidden="true">♙</span>Cuenta
        </button>
        <button
          type="button"
          disabled
          title="Próximamente"
          aria-label="Bolsa, próximamente"
        >
          <span aria-hidden="true">♧</span>Bolsa
        </button>
      </nav>
    </>
  );
}
