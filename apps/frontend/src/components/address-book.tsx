"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@ok-family/shared";
type Address = {id: string; label: string; recipientName: string; phone: string; street: string; number: string; neighborhood: string; postalCode: string; city: string; state: string; references: string | null};
type Coverage = {status: "available" | "unavailable" | "not_configured"; priceInCents?: number};
export function AddressBook() {
  const [items,setItems] = useState<Address[]>([]); const [status,setStatus] = useState<"loading"|"ready"|"login"|"error">("loading"); const [editing,setEditing] = useState<Address | "new" | null>(null); const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false); const [coverage,setCoverage] = useState<Record<string,Coverage>>({});
  const load = useCallback(async () => {try {const response = await fetch("/api/tienda/addresses",{cache:"no-store"}); if(response.status === 401){setStatus("login");return;} if(!response.ok) throw new Error(); setItems(await response.json() as Address[]); setStatus("ready");} catch {setStatus("error");}},[]);
  useEffect(() => {void load();},[load]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const keys = ["label","recipientName","phone","street","number","neighborhood","postalCode","city","state","references"];
    const data = Object.fromEntries(keys.map(key => [key,form.get(key)]));
    try {const response = await fetch(editing === "new" ? "/api/tienda/addresses" : "/api/tienda/addresses/" + (editing as Address).id,{method:editing === "new" ? "POST" : "PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(data)}); const value=await response.json(); if(response.status===401){setStatus("login");return;} if(!response.ok) throw new Error(value.message || "Revisa los datos."); setEditing(null);setCoverage({});await load();setMessage("Dirección guardada.");} catch(error){setMessage(error instanceof Error ? error.message : "Intenta nuevamente.");} finally {setBusy(false);}
  }
  async function remove(address: Address) {
    if(!window.confirm("¿Eliminar la dirección " + address.label + "?")) return;
    setBusy(true);setMessage("");
    try {const response=await fetch("/api/tienda/addresses/"+address.id,{method:"DELETE"});const value=await response.json();if(response.status===401){setStatus("login");return;}if(!response.ok)throw new Error(value.message||"No pudimos eliminar la dirección.");await load();setMessage("Dirección eliminada.");} catch(error){setMessage(error instanceof Error ? error.message : "Intenta nuevamente.");} finally {setBusy(false);}
  }
  async function check(address: Address) {
    setBusy(true);setMessage("");
    try {const response=await fetch("/api/tienda/addresses/"+address.id+"/coverage",{cache:"no-store"});const value=await response.json();if(response.status===401){setStatus("login");return;}if(!response.ok)throw new Error(value.message||"No pudimos consultar la cobertura.");setCoverage(previous=>({...previous,[address.id]:value as Coverage}));} catch(error){setMessage(error instanceof Error ? error.message : "Intenta nuevamente.");} finally {setBusy(false);}
  }
  const current = editing && editing !== "new" ? editing : null;
  return <section className="shell basket-page"><p className="eyebrow">MI CUENTA</p><h1>Mis direcciones</h1><p>Guarda los datos para futuras entregas locales.</p>
    {status==="loading" && <p role="status">Cargando direcciones…</p>}
    {status==="login" && <div className="basket-panel"><p>Inicia sesión para administrar tus direcciones.</p><Link className="button" href="/cuenta">INICIAR SESIÓN</Link></div>}
    {status==="error" && <div className="basket-panel"><p>No pudimos cargar tus direcciones.</p><button className="button" onClick={() => {setStatus("loading");void load();}}>REINTENTAR</button></div>}
    {status==="ready" && <div className="basket-panel">
      {message && <p role="status">{message}</p>}
      {!editing && <button className="button" type="button" onClick={() => {setMessage("");setEditing("new");}}>+ AGREGAR DIRECCIÓN</button>}
      {editing && <form className="address-form" onSubmit={save} key={current?.id || "new"}>
        <h2>{current ? "Editar dirección" : "Nueva dirección"}</h2>
        <label>Nombre para identificarla<input name="label" required maxLength={80} defaultValue={current?.label || ""} placeholder="Casa, trabajo…" /></label>
        <label>Nombre de quien recibe<input name="recipientName" autoComplete="name" required minLength={2} maxLength={120} defaultValue={current?.recipientName || ""} /></label>
        <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={20} defaultValue={current?.phone || ""} /></label>
        <label>Calle<input name="street" autoComplete="address-line1" required minLength={2} maxLength={180} defaultValue={current?.street || ""} /></label>
        <label>Número exterior e interior<input name="number" required maxLength={30} defaultValue={current?.number || ""} /></label>
        <label>Colonia<input name="neighborhood" required minLength={2} maxLength={120} defaultValue={current?.neighborhood || ""} /></label>
        <label>Código postal<input name="postalCode" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{5}" maxLength={5} defaultValue={current?.postalCode || ""} /></label>
        <label>Ciudad<input name="city" autoComplete="address-level2" required minLength={2} maxLength={120} defaultValue={current?.city || "Durango"} /></label>
        <label>Estado<input name="state" autoComplete="address-level1" required minLength={2} maxLength={120} defaultValue={current?.state || "Durango"} /></label>
        <label>Referencias (opcional)<textarea name="references" maxLength={500} defaultValue={current?.references || ""} /></label>
        <div className="address-buttons"><button className="button" disabled={busy} type="submit">{busy ? "GUARDANDO…" : "GUARDAR DIRECCIÓN"}</button><button className="button button-secondary" disabled={busy} type="button" onClick={() => {setEditing(null);setMessage("");}}>CANCELAR</button></div>
      </form>}
      {!items.length && !editing && <p>Aún no tienes direcciones guardadas.</p>}
      {items.map(address => <article className="address-row" key={address.id}><h2>{address.label}</h2><p>{address.recipientName} · {address.phone}</p><p>{address.street} {address.number}, {address.neighborhood}<br />{address.city}, {address.state}, C.P. {address.postalCode}</p>{address.references && <p>{address.references}</p>}
        {coverage[address.id] && <p role="status">{coverage[address.id]?.status==="not_configured" ? "La cobertura local y sus tarifas aún están por definirse." : coverage[address.id]?.status==="unavailable" ? "Por ahora no hay entrega disponible para este código postal." : "Entrega disponible: " + formatMoney(coverage[address.id]?.priceInCents ?? 0) + " MXN."}</p>}
        <div className="address-buttons"><button type="button" disabled={busy} onClick={() => void check(address)}>Consultar cobertura</button><button type="button" disabled={busy} onClick={() => {setMessage("");setEditing(address);}}>Editar</button><button type="button" disabled={busy} onClick={() => void remove(address)}>Eliminar</button></div>
      </article>)}
    </div>}
    <Link className="text-link account-back" href="/carrito">← Volver a mi carrito</Link>
  </section>;
}
