"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nextOrderState, type OrderState } from "@ok-family/shared";

export function OrderAction({id,status,pickup}: {id:string;status:OrderState;pickup:boolean}) {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const next = nextOrderState(status,pickup);
  if (!next) return null;
  const label = {CANCELADO:"Cancelar y liberar reserva", PREPARANDO:"Empezar preparación",
    LISTO_PARA_ENVIO:pickup?"Marcar listo para recoger":"Marcar listo para envío",
    ENVIADO:"Marcar en reparto", ENTREGADO:pickup?"Confirmar recogida":"Confirmar entrega", PAGADO:"", PENDIENTE_PAGO:""}[next];
  async function update() {
    if (!window.confirm(label + " · Pedido " + id.slice(0,8).toUpperCase() + " ¿Continuar?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/orders/"+id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({previous:status,next})});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "No se pudo actualizar el pedido.");
      }
    } catch (cause) {setError(cause instanceof Error ? cause.message : "No se pudo actualizar el pedido.");}
    finally {router.refresh(); setBusy(false);}
  }
  return <div><button className="button" type="button" disabled={busy} onClick={update}>{busy?"Guardando…":label}</button>
    {error && <p role="alert" className="admin-alert">{error}</p>}</div>;
}
