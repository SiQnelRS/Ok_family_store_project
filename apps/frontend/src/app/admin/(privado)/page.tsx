import Link from "next/link";
import { formatMoney } from "@ok-family/shared";
import type { AdminCatalogResponse } from "@ok-family/shared";
import { adminRead } from "../../../lib/admin";
import { ProductRowActions } from "../../../components/admin/product-actions";
import type { SearchValues } from "../../../lib/catalog";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchValues>;
}) {
  const values = await searchParams;
  const first = (key: string) =>
    (Array.isArray(values[key]) ? values[key][0] : values[key])?.trim() || "";
  const q = first("q").slice(0, 100);
  const status = ["published", "draft", "out"].includes(first("status"))
    ? first("status")
    : "all";
  const rawPage = Number(first("page"));
  const page =
    Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "12",
    status,
  });
  if (q) params.set("q", q);
  const data = await adminRead<AdminCatalogResponse>(
    "/api/admin/products?" + params,
  );
  const pageHref = (next: number) => {
    const query = new URLSearchParams(params);
    query.set("page", String(next));
    query.delete("pageSize");
    return "/admin?" + query;
  };
  const counts = [
    ["Todos los productos", data.counts.all, "all"],
    ["Visibles en tienda", data.counts.published, "published"],
    ["Ocultos o borradores", data.counts.hidden, "draft"],
    ["Sin existencias", data.counts.out, "out"],
  ];
  const messages: Record<string, string> = {
    created: "Producto creado correctamente.",
    saved: "Cambios guardados. Tu tienda ya está actualizada.",
    deleted: "El producto se eliminó correctamente.",
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Mis productos</h1>
          <p>Todo lo que vendes, fácil de organizar y actualizar.</p>
        </div>
        <Link href="/admin/productos/nuevo" className="button">
          + Agregar producto
        </Link>
      </div>
      {messages[first("done")] && (
        <p className="admin-success" role="status">
          {messages[first("done")]}
        </p>
      )}
      <div className="admin-counts">
        {counts.map(([label, count, filter]) => (
          <Link
            key={filter}
            href={"/admin?status=" + filter}
            className={"admin-count" + (status === filter ? " selected" : "")}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </Link>
        ))}
      </div>
      <section
        className="admin-card admin-list-card"
        aria-labelledby="list-title"
      >
        <div className="admin-list-heading">
          <h2 id="list-title">Tus publicaciones</h2>
          <span>
            {data.total} resultado{data.total === 1 ? "" : "s"}
          </span>
        </div>
        <form className="admin-list-filters" action="/admin">
          <div>
            <label className="sr-only" htmlFor="admin-search">
              Buscar productos
            </label>
            <input
              id="admin-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={100}
              placeholder="Buscar por nombre o descripción…"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="admin-status">
              Visibilidad
            </label>
            <select id="admin-status" name="status" defaultValue={status}>
              <option value="all">Todos los productos</option>
              <option value="published">Visibles en tienda</option>
              <option value="draft">Ocultos o borradores</option>
              <option value="out">Sin existencias</option>
            </select>
          </div>
          <button type="submit" className="button button-secondary">
            Buscar
          </button>
          {(q || status !== "all") && <Link href="/admin">Limpiar</Link>}
        </form>
        {data.items.length ? (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Existencias</th>
                  <th scope="col">En la tienda</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => (
                  <tr key={product.id}>
                    <td className="admin-product-cell">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt=""
                          width={56}
                          height={64}
                        />
                      ) : (
                        <span className="admin-no-photo">Sin foto</span>
                      )}
                      <div>
                        <Link href={"/admin/productos/" + product.id}>
                          {product.name}
                        </Link>
                        <span>
                          {product.category} ·{" "}
                          {product.type === "LOTE"
                            ? product.piecesPerUnit + " piezas por lote"
                            : "Individual"}
                          {product.isDemo ? " · Ejemplo" : ""}
                        </span>
                      </div>
                    </td>
                    <td data-label="Precio">
                      <strong>{formatMoney(product.priceInCents)}</strong>
                      <span>
                        {product.type === "LOTE" ? "por lote" : "por unidad"}
                      </span>
                    </td>
                    <td data-label="Disponibles">
                      {product.availableQuantity}{" "}
                      {product.type === "LOTE"
                        ? product.availableQuantity === 1
                          ? "lote"
                          : "lotes"
                        : product.availableQuantity === 1
                          ? "unidad"
                          : "unidades"}
                    </td>
                    <td data-label="Visibilidad">
                      <span
                        className={
                          "admin-badge " +
                          (product.published ? "visible" : "hidden")
                        }
                      >
                        {product.published ? "Visible" : "Oculto"}
                      </span>
                    </td>
                    <td>
                      <ProductRowActions product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Math.ceil(data.total / data.pageSize) > 1 && (
              <nav
                className="admin-pagination"
                aria-label="Páginas de productos"
              >
                {page > 1 ? (
                  <Link href={pageHref(page - 1)}>← Anterior</Link>
                ) : (
                  <span />
                )}
                <span>
                  Página {page} de {Math.ceil(data.total / data.pageSize)}
                </span>
                {page * data.pageSize < data.total ? (
                  <Link href={pageHref(page + 1)}>Siguiente →</Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        ) : (
          <div className="admin-empty">
            <h3>
              {q || status !== "all"
                ? "No encontramos productos con ese filtro."
                : "Aquí aparecerán tus productos."}
            </h3>
            <p>
              {q || status !== "all"
                ? "Prueba otro nombre o revisa todos tus productos."
                : "Comienza agregando una foto, un nombre y un precio."}
            </p>
            <Link
              className="button button-secondary"
              href={q || status !== "all" ? "/admin" : "/admin/productos/nuevo"}
            >
              {q || status !== "all"
                ? "Ver todos"
                : "Agregar mi primer producto"}
            </Link>
          </div>
        )}
      </section>
      <section className="admin-help" id="ayuda">
        <h2>Tu panel en tres pasos</h2>
        <div>
          <article>
            <b>01 · Agrega</b>
            <p>Escribe un nombre, sube una foto y coloca el precio en pesos.</p>
          </article>
          <article>
            <b>02 · Organiza</b>
            <p>
              Indica cuántas unidades o lotes tienes y si quieres mostrarlos en
              la tienda.
            </p>
          </article>
          <article>
            <b>03 · Actualiza</b>
            <p>
              Usa Editar para cambiar los datos. Ocultar retira el producto sin
              borrarlo.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
