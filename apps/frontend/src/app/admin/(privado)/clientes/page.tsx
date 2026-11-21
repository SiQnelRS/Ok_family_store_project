import Link from "next/link";
import { adminRead } from "../../../../lib/admin";
import { CustomerStatusButton } from "../../../../components/admin/customer-status";
import type { SearchValues } from "../../../../lib/catalog";
type Customer = {id: string; name: string; email: string; phone: string | null; isActive: boolean; createdAt: string};
type Result = {items: Customer[]; total: number; page: number; pageSize: number};
export default async function CustomersPage({searchParams}: {searchParams: Promise<SearchValues>}) {
  const values = await searchParams;
  const first = (key: string) => (Array.isArray(values[key]) ? values[key][0] : values[key])?.trim() || "";
  const q = first("q").slice(0, 100);
  const number = Number(first("page"));
  const page = Number.isInteger(number) && number > 0 && number <= 10000 ? number : 1;
  const query = new URLSearchParams({page: String(page)});
  if (q) query.set("q", q);
  const data = await adminRead<Result>("/api/admin/customers?" + query);
  function href(next: number) { const params = new URLSearchParams(query); params.set("page", String(next)); return "/admin/clientes?" + params; }
  return <>
    <div className="admin-page-heading"><div><h1>Clientes</h1><p>Consulta las cuentas y administra su acceso a la tienda.</p></div></div>
    <section className="admin-card admin-list-card" aria-labelledby="customers-title">
      <div className="admin-list-heading"><h2 id="customers-title">Cuentas de clientes</h2><span>{data.total} resultado{data.total === 1 ? "" : "s"}</span></div>
      <form className="customer-search" action="/admin/clientes">
        <label className="sr-only" htmlFor="customer-search">Buscar por nombre o correo</label>
        <input id="customer-search" name="q" type="search" maxLength={100} defaultValue={q} placeholder="Buscar por nombre o correo" />
        <button className="button" type="submit">Buscar</button>{q && <Link href="/admin/clientes">Limpiar</Link>}
      </form>
      {data.items.length === 0 ? <p className="admin-muted">{q ? "No encontramos clientes con esa búsqueda." : "Todavía no hay cuentas de clientes."}</p> :
      <div className="customer-list">{data.items.map(customer => <article className="customer-row" key={customer.id}>
        <div><h3>{customer.name}</h3><p>{customer.email}</p>{customer.phone && <p>{customer.phone}</p>}<p>Registro: {new Intl.DateTimeFormat("es-MX", {dateStyle: "medium", timeZone: "America/Mexico_City"}).format(new Date(customer.createdAt))}</p></div>
        <div className="customer-row-action"><span className={customer.isActive ? "customer-status active" : "customer-status inactive"}>{customer.isActive ? "Activa" : "Desactivada"}</span><CustomerStatusButton id={customer.id} name={customer.name} active={customer.isActive} /></div>
      </article>)}</div>}
      <nav className="customer-pagination" aria-label="Páginas de clientes">
        {page > 1 && <Link href={href(page - 1)}>← Anterior</Link>}
        <span>Página {page}</span>
        {page * data.pageSize < data.total && <Link href={href(page + 1)}>Siguiente →</Link>}
      </nav>
    </section>
  </>;
}
