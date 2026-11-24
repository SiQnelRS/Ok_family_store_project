"use client";
import Link from "next/link";
import { useState } from "react";
export function AddToCart({slug, available}: {slug: string; available: number}) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [login, setLogin] = useState(false); const [added, setAdded] = useState(false);
  async function add() {
    setBusy(true); setMessage(""); setLogin(false); setAdded(false);
    try {
      const response = await fetch("/api/tienda/cart", {method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({slug, quantity: 1, add: true})});
      const result = await response.json();
      if (response.status === 401) {setLogin(true); return;}
      if (!response.ok) throw new Error(result.message || "No pudimos agregarlo.");
      setAdded(true); setMessage("Agregado a tu carrito. La mercancía no se reserva todavía.");
    } catch (error) {setMessage(error instanceof Error ? error.message : "Intenta nuevamente.");} finally {setBusy(false);}
  }
  return <div className="add-to-cart"><button className="button purchase-unavailable" type="button" disabled={busy || available < 1} onClick={add}>{busy ? "AGREGANDO…" : available < 1 ? "NO DISPONIBLE" : "AGREGAR AL CARRITO"}</button>
    {login && <p className="detail-note">Para guardar tu carrito, <Link className="text-link" href="/cuenta">inicia sesión o crea una cuenta</Link>.</p>}
    {message && <p className="detail-note" role="status">{message} {added && <Link className="text-link" href="/carrito">Ver mi carrito →</Link>}</p>}
    <p className="detail-note">Los artículos en tu carrito no están apartados.</p>
  </div>;
}
