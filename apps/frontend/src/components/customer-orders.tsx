"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney, orderLabel, type OrderState } from "@ok-family/shared";

type Order = {
  id: string; createdAt: string; status: OrderState; totalInCents: number; shippingInCents: number;
  shippingAddressSnapshot: {method?: string; street?: string; number?: string; store?: string};
  reservation?: {status: string; expiresAt: string};
  items: {id: string; productName: string; quantity: number; subtotalInCents: number}[];
};

export function CustomerOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/tienda/orders", {cache: "no-store"});
      if (response.status === 401) {setOrders(null); setMessage("Inicia sesión para consultar tus pedidos."); return;}
      if (!response.ok) throw new Error();
      setOrders(await response.json()); setMessage("");
    } catch {setMessage("No pudimos consultar tus pedidos.");}
  }, []);
  useEffect(() => {void load(); const timer = setInterval(load, 15000); return () => clearInterval(timer);}, [load]);
  async function cancel(id: string) {
    if (!window.confirm("¿Cancelar este pedido y liberar sus artículos?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/tienda/orders/" + id + "/cancel", {method: "POST", headers: {"content-type": "application/json"}, body: "{}"});
      if (!response.ok) throw new Error();
      await load();
    } catch {setMessage("No pudimos cancelar el pedido. Actualiza e intenta nuevamente.");}
    finally {setBusy(false);}
  }
  return <section className="shell basket-page"><h1>Mis pedidos</h1>
    <Link className="text-link" href="/cuenta">Mi cuenta</Link>
    {message && <p role="alert">{message}</p>}
    {!orders && !message && <p role="status">Cargando pedidos…</p>}
    {orders?.length === 0 && <p>Aún no tienes pedidos.</p>}
    {orders?.map(order => <article key={order.id} className="basket-panel">
      <h2>Pedido {order.id.slice(0, 8).toUpperCase()}</h2>
      <p>{new Date(order.createdAt).toLocaleString("es-MX")} · {order.reservation?.status === "EXPIRADA" ? "Reserva vencida" : orderLabel(order.status, order.shippingAddressSnapshot.method === "pickup")}</p>
      <p>{order.shippingAddressSnapshot.method === "pickup" ? "Recoger en tienda · " + order.shippingAddressSnapshot.store : "Entrega a domicilio · " + [order.shippingAddressSnapshot.street, order.shippingAddressSnapshot.number].filter(Boolean).join(" ")}</p>
      <ul>{order.items.map(item => <li key={item.id}>{item.quantity} × {item.productName} · {formatMoney(item.subtotalInCents)} MXN</li>)}</ul>
      <p>Envío: {formatMoney(order.shippingInCents)} MXN · <strong>Total: {formatMoney(order.totalInCents)} MXN</strong></p>
      {order.reservation?.status === "ACTIVA" && <><p>Reservado hasta {new Date(order.reservation.expiresAt).toLocaleString("es-MX")}.</p>
        <button className="button button-secondary" disabled={busy} onClick={() => void cancel(order.id)}>Cancelar pedido</button></>}
    </article>)}
  </section>;
}
