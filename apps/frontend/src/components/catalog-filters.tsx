"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogFilters } from "../lib/catalog";

export function CatalogFiltersPanel({
  filters,
  action,
}: {
  filters: CatalogFilters;
  action: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const openLinkedFilters = () => {
      if (window.location.hash === "#filtros") setOpen(true);
    };
    openLinkedFilters();
    window.addEventListener("hashchange", openLinkedFilters);
    return () => window.removeEventListener("hashchange", openLinkedFilters);
  }, []);
  function filterForm(id: string) {
    return (
      <form
        action={action + "#catalogo"}
        method="get"
        className="filters"
        role="search"
      >
        <div className="field">
          <label htmlFor={id + "-q"}>BUSCAR</label>
          <input
            id={id + "-q"}
            name="q"
            type="search"
            placeholder="Nombre o descripción"
            defaultValue={filters.q}
            maxLength={100}
          />
        </div>
        <fieldset>
          <legend>TIPO DE PUBLICACIÓN</legend>
          {[
            ["", "Todos los productos"],
            ["LOTE", "Lotes completos"],
            ["PRODUCTO", "Productos individuales"],
          ].map(([value, label]) => (
            <label className="radio-option" key={value}>
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={filters.type === value}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor={id + "-category"}>CATEGORÍA</label>
          <input
            id={id + "-category"}
            name="category"
            list={id + "-categories"}
            defaultValue={filters.category}
            placeholder="Todas las categorías"
            maxLength={80}
          />
          <datalist id={id + "-categories"}>
            <option value="Ropa" />
            <option value="Calzado" />
            <option value="Hogar" />
          </datalist>
        </div>
        <button className="button apply-filters" type="submit">
          APLICAR FILTROS <span aria-hidden="true">→</span>
        </button>
        {(filters.q || filters.type || filters.category) && (
          <a className="clear-filters" href={action + "#catalogo"}>
            Limpiar filtros ×
          </a>
        )}
      </form>
    );
  }
  return (
    <div id="filtros">
      <aside className="catalog-sidebar" aria-label="Filtros del catálogo">
        <h2>FILTRAR PUBLICACIONES</h2>
        {filterForm("desktop")}
      </aside>
      <div className="mobile-filter">
        <button
          ref={toggle}
          className="mobile-filter-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-filters"
          onClick={() => setOpen(!open)}
        >
          FILTROS: BÚSQUEDA · CATEGORÍA · TIPO{" "}
          <span aria-hidden="true">{open ? "−" : "⌄"}</span>
        </button>
        {open && (
          <div
            id="mobile-filters"
            className="mobile-filter-panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            {filterForm("mobile")}
          </div>
        )}
      </div>
    </div>
  );
}
