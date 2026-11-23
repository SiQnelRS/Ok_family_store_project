"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@ok-family/shared";
import type { ProductSummary } from "@ok-family/shared";
type Item = {slug: string; quantity: number; product: ProductSummary | null; available: boolean};
type Cart = {items: Item[]; subtotalInCents: number; complete: boolean};
type Address = {id: string; label: string; postalCode: string};
type Quote = {version: string; status: "available" | "unavailable" | "not_configured" | "cart_unavailable"; subtotalInCents: number; shippingInCents?: number; totalInCents?: number | null};
export function ShoppingCart() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState("");
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "login" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/tienda/cart", {cache: "no-store"});
      if (response.status === 401) {setStatus("login"); return;}
      if (!response.ok) throw new Error();
      setCart(await response.json() as Cart);
      const addressResponse = await fetch("/api/tienda/addresses", {cache: "no-store"});
      if (addressResponse.status === 401) {setStatus("login"); return;}
      if (!addressResponse.ok) throw new Error();
      setAddresses(await addressResponse.json() as Address[]);
      setStatus("ready");
    } catch {setStatus("error");}
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!cart?.items.length || status !== "ready" || (method === "delivery" && !selected)) return;
    let current = true;
    async function getQuote() {
      setQuote(null); setQuoteError("");
      try {
        const path = method === "pickup" ? "pickup/quote" : "addresses/" + selected + "/quote";
        const response = await fetch("/api/tienda/" + path, {cache: "no-store"});
        if (!response.ok) throw new Error();
        const value = await response.json() as Quote;
        if (current) setQuote(value);
      } catch { if (current) setQuoteError("No pudimos calcular esta opción. Intenta nuevamente."); }
    }
    void getQuote();
    return () => {current = false;};
  }, [cart, method, selected, status]);
  const checkoutKey = useRef({signature: "", key: ""});
  async function reserve() {
    if (!quote?.totalInCents || busy) return;
    const data = {method, ...(method === "delivery" ? {addressId: selected} : {}), version: quote.version, totalInCents: quote.totalInCents};
    const signature = JSON.stringify(data);
    if (checkoutKey.current.signature !== signature) checkoutKey.current = {signature, key: crypto.randomUUID()};
    setBusy("checkout"); setMessage("");
    try {
      const response = await fetch("/api/tienda/orders", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({...data, key: checkoutKey.current.key})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No pudimos crear tu pedido.");
      window.location.assign("/cuenta/pedidos");
    } catch (error) {setMessage(error instanceof Error ? error.message : "Consulta tus pedidos antes de volver a intentar."); await load();}
    finally {setBusy("");}
  }
  async function change(slug: string, quantity: number | null) {
    setBusy(slug); setMessage(""); setQuote(null); setQuoteError("");
    try {
      const response = await fetch(quantity === null ? "/api/tienda/cart/" + slug : "/api/tienda/cart", {
        method: quantity === null ? "DELETE" : "POST",
        headers: {"content-type": "application/json"},
        ...(quantity === null ? {} : {body: JSON.stringify({slug, quantity})}),
      });
      const value = await response.json();
      if (response.status === 401) {setStatus("login"); return;}
      if (!response.ok) throw new Error(value.message || "No pudimos actualizar tu carrito.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Intenta nuevamente.");
      await load();
    } finally {setBusy("");}
  }
  return <section className="shell basket-page">
    <p className="eyebrow">OK FAMILY STORE</p><h1>Mi carrito</h1><p>Revisa tus artículos y prepara la forma de recibirlos.</p>
    {status === "loading" && <p role="status">Cargando tu carrito…</p>}
    {status === "login" && <div className="basket-panel"><h2>Tu carrito te espera</h2><p>Inicia sesión para guardar tus artículos y direcciones.</p><Link className="button" href="/cuenta">INICIAR SESIÓN</Link></div>}
    {status === "error" && <div className="basket-panel"><p>No pudimos cargar tu carrito.</p><button className="button" type="button" onClick={() => {setStatus("loading"); void load();}}>REINTENTAR</button></div>}
    {status === "ready" && cart && <div className="basket-layout">
      <div className="basket-panel">
        {message && <p className="account-error" role="alert">{message}</p>}
        {cart.items.length === 0 ? <><h2>Tu carrito está vacío.</h2><p>Descubre productos y lotes en el catálogo.</p><Link className="button" href="/catalogo">EXPLORAR CATÁLOGO</Link></> :
          cart.items.map(item => <article className="basket-item" key={item.slug}>
            {item.product?.images[0] && <img src={item.product.images[0].url} alt={item.product.images[0].alt || item.product.name} width={100} height={100} />}
            <div className="basket-item-details">
              <h2>{item.product ? <Link href={"/productos/" + item.slug}>{item.product.name}</Link> : "Publicación no disponible"}</h2>
              {item.product && <><p>{formatMoney(item.product.priceInCents)} MXN / {item.product.type === "LOTE" ? "lote completo" : "unidad"}</p>{item.product.type === "LOTE" && <p>{item.product.piecesPerUnit} piezas por lote</p>}{item.product.isDemo && <p>Publicación de ejemplo</p>}</>}
              {!item.available && <p className="account-error">La cantidad solicitada ya no está disponible. Ajusta la cantidad o retira el artículo.</p>}
              <div className="basket-actions">
                <form onSubmit={event => {event.preventDefault(); const n = Number(new FormData(event.currentTarget).get("quantity")); if (Number.isInteger(n) && n > 0 && n !== item.quantity) void change(item.slug, n);}}>
                  <label>Cantidad <input name="quantity" type="number" min={1} max={item.product?.availableQuantity || 1000} defaultValue={item.quantity} key={item.slug + item.quantity} disabled={!!busy || !item.product} /></label>{" "}
                  <button type="submit" disabled={!!busy || !item.product}>Actualizar</button>
                </form>
                <button type="button" disabled={!!busy} onClick={() => void change(item.slug, null)}>Eliminar</button>
              </div>
            </div>
          </article>)}
      </div>
      <aside className="basket-panel basket-summary">
        <h2>Resumen</h2>
        <p>Subtotal <strong>{formatMoney(quote?.subtotalInCents ?? cart.subtotalInCents)} MXN</strong></p>
        {!cart.complete && cart.items.length > 0 && <p>Revisa los artículos no disponibles. El subtotal solo incluye publicaciones consultables.</p>}
        {cart.items.length > 0 && <>
          <fieldset className="basket-methods">
            <legend>¿Cómo quieres recibir tu pedido?</legend>
            <label><input type="radio" name="receiving-method" checked={method === "delivery"} onChange={() => {setMethod("delivery"); setQuote(null); setQuoteError("");}} /><span><strong>Entrega a domicilio</strong><small>La disponibilidad depende de tu código postal.</small></span></label>
            <label><input type="radio" name="receiving-method" checked={method === "pickup"} onChange={() => {setMethod("pickup"); setQuote(null); setQuoteError("");}} /><span><strong>Recoger en tienda</strong><small>Recoge tu mercancía en el local.</small></span></label>
          </fieldset>
          {method === "delivery" && <>
            <label className="basket-address-label">Dirección de entrega
              <select value={selected} onChange={event => {setSelected(event.target.value); setQuote(null); setQuoteError("");}}>
                <option value="">Selecciona una dirección</option>
                {addresses.map(address => <option key={address.id} value={address.id}>{address.label} · C.P. {address.postalCode}</option>)}
              </select>
            </label>
            {!selected && <p>Selecciona una dirección para consultar la cobertura.</p>}
            {quote?.status === "not_configured" && <p>La cobertura local y sus tarifas aún están por definirse.</p>}
            {quote?.status === "unavailable" && <p>Por ahora no hay entrega disponible para este código postal.</p>}
            {quote?.status === "cart_unavailable" && <p>Revisa los artículos no disponibles para calcular la entrega.</p>}
            {selected && !quote && !quoteError && <p role="status">Consultando cobertura y tarifa…</p>}
            {quote?.status === "available" && <><p>Entrega <strong>{formatMoney(quote.shippingInCents ?? 0)} MXN</strong></p><p>Total estimado <strong>{formatMoney(quote.totalInCents ?? quote.subtotalInCents)} MXN</strong></p></>}
            <Link className="button button-secondary" href="/cuenta/direcciones">MIS DIRECCIONES</Link>
          </>}
          {method === "pickup" && <>
            <p>Recoge tu mercancía en la tienda, sin costo de envío.</p>
            <div className="basket-pickup-location"><strong>Ok Family Store</strong><address>Boulevard de las Rosas 233<br />Jardines de Durango, Durango</address><p>Horario: 12:00 p. m. a 8:30 p. m.</p></div>
            {quote?.status === "cart_unavailable" && <p>Revisa los artículos no disponibles para calcular el total.</p>}
            {!quote && !quoteError && <p role="status">Calculando total…</p>}
            {quote?.status === "available" && <><p>Recoger en tienda <strong>Sin costo adicional</strong></p><p>Total estimado <strong>{formatMoney(quote.totalInCents ?? quote.subtotalInCents)} MXN</strong></p></>}
          </>}
          {quoteError && <p className="account-error" role="alert">{quoteError}</p>}
        </>}
        {cart.items.length > 0 && <><p>Al crear el pedido apartamos tus artículos durante 15 minutos. El cobro en línea estará disponible más adelante.</p><button type="button" className="button" disabled={!!busy || quote?.status !== "available"} onClick={() => void reserve()}>{busy === "checkout" ? "Reservando…" : "Crear pedido y reservar"}</button></>}
        <Link className="text-link account-back" href="/cuenta/pedidos">Mis pedidos →</Link>
      </aside>
    </div>}
  </section>;
}
