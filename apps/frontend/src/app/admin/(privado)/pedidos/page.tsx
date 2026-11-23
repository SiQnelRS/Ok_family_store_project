import Link from "next/link";
import { formatMoney, orderLabel, orderLabels, type OrderState } from "@ok-family/shared";
import { adminRead } from "../../../../lib/admin";
import { OrderAction } from "../../../../components/admin/order-action";

type Row = {
  id:string;status:OrderState;createdAt:string;totalInCents:number;shippingInCents:number;
  destination:Record<string,string> | null;customer?:{name:string;email:string};reservation?:string;
  items:{name:string;quantity:number;amount:number}[];operations:{date:string;status:OrderState}[];
};
const date = (value:string) => new Intl.DateTimeFormat("es-MX",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Monterrey"}).format(new Date(value));
export default async function AdminOrdersPage({searchParams}:{searchParams:Promise<{page?:string;status?:string}>}) {
  const filters = await searchParams;
  const n = Number(filters.page);
  const page = Number.isInteger(n) && n>0 && n<=100000 ? n : 1;
  const query = new URLSearchParams({page:String(page)});
  if (filters.status && Object.hasOwn(orderLabels,filters.status)) query.set("status",filters.status);
  const {items,hasMore} = await adminRead<{items:Row[];hasMore:boolean}>("/api/admin/orders?"+query);
  function href(n:number) {const params=new URLSearchParams(query);params.set("page",String(n));return "/admin/pedidos?"+params;}
  return <><header className="admin-page-heading"><div><h1>Pedidos</h1><p>Consulta quién hizo cada pedido y qué falta para entregarlo.</p></div></header>
    <section className="admin-card"><form className="customer-search" action="/admin/pedidos"><label>Estado del pedido <select name="status" defaultValue={query.get("status") ?? ""}><option value="">Todos</option>
      {Object.entries(orderLabels).map(([id,name])=><option value={id} key={id}>{id==="LISTO_PARA_ENVIO"?"Listo para envío o recogida":name}</option>)}</select></label><button className="button">Filtrar</button></form>
    {!items.length && <p>No hay pedidos para mostrar.</p>}
    {items.map(row=>{
      const d=row.destination ?? {}, pickup=d.method==="pickup";
      return <article className="customer-row" key={row.id}><div><h2>Pedido {row.id.slice(0,8).toUpperCase()}</h2>
        <p>{date(row.createdAt)} · {pickup?"Recogida en tienda":"Entrega a domicilio"}</p>
        <p><strong>{row.customer?.name ?? "Cliente"}</strong> {row.customer?.email}</p>
        <p>{row.reservation==="EXPIRADA"?"Reserva vencida":orderLabel(row.status,pickup)} · {formatMoney(row.totalInCents)} MXN</p>
        <details><summary>Ver artículos y entrega</summary>
          <ul>{row.items.map((item,i)=><li key={i}>{item.quantity} × {item.name} · {formatMoney(item.amount)} MXN</li>)}</ul>
          <p>Envío: {formatMoney(row.shippingInCents)} MXN</p>
          {pickup?<p>{d.store}</p>:<><p>{d.recipientName} · {d.phone}</p><p>{[d.street,d.number,d.neighborhood,d.city,d.state,d.postalCode].filter(Boolean).join(", ")}</p>{d.references && <p>{d.references}</p>}</>}
          {!!row.operations.length && <><h3>Cambios del panel</h3><ul>{row.operations.map(op=><li key={op.status}>{date(op.date)} · {orderLabel(op.status,pickup)}</li>)}</ul></>}
        </details></div><OrderAction id={row.id} status={row.status} pickup={pickup}/></article>;
    })}
    <nav className="customer-pagination" aria-label="Páginas de pedidos">{page>1 && <Link href={href(page-1)}>Anterior</Link>}<span>Página {page}</span>{hasMore && <Link href={href(page+1)}>Siguiente</Link>}</nav></section></>;
}
