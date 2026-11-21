"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function CustomerStatusButton({id, name, active}: {id: string; name: string; active: boolean}) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function change() {
    const message = active ? "¿Desactivar la cuenta de " + name + "? Se cerrarán sus sesiones y no podrá ingresar hasta que la reactives." : "¿Reactivar la cuenta de " + name + "? Podrá volver a iniciar sesión.";
    if (!window.confirm(message)) return;
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/customers/" + id, {method: "PATCH", headers: {"content-type": "application/json"}, body: JSON.stringify({active: !active, expectedActive: active})});
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "No pudimos cambiar el estado.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta nuevamente."); } finally { setBusy(false); }
  }
  return <div><button className="button button-secondary customer-action" type="button" onClick={change} disabled={busy}>{busy ? "Guardando…" : active ? "Desactivar" : "Reactivar"}</button>{error && <p className="admin-alert" role="alert">{error}</p>}</div>;
}
