"use client";
import Link from "next/link";
import { AccountSettings } from "./account-settings";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function CustomerAccount({user, unavailable, passwordUpdated}: {user: {name: string; email: string} | null; unavailable: boolean; passwordUpdated: boolean}) {
  const router = useRouter(); const [register, setRegister] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    if (register && form.get("password") !== form.get("confirm")) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/cuenta/" + (register ? "register" : "login"), {method:"POST", headers: {"content-type":"application/json"}, body: JSON.stringify({...(register ? {name: form.get("name")} : {}), email: form.get("email"), password: form.get("password")})});
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Intenta nuevamente.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta nuevamente."); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/cuenta/logout", {method:"POST", headers: {"content-type":"application/json"}, body: "{}"});
      if (!response.ok) throw new Error("No pudimos cerrar tu sesión. Intenta nuevamente."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta nuevamente."); } finally { setBusy(false); }
  }
  return <section className="account-page shell"><div className="account-card">
      <p className="account-kicker">OK FAMILY STORE</p>
      {unavailable ? <><h1>No pudimos cargar tu cuenta.</h1><p>Intenta nuevamente en un momento.</p><button className="button" onClick={() => router.refresh()}>REINTENTAR</button></>
      : user ? <><h1>Hola, {user.name}.</h1><p>Bienvenido a tu cuenta de Ok Family Store.</p><dl><dt>Correo electrónico</dt><dd>{user.email}</dd></dl>{error && <p role="alert" className="account-error">{error}</p>}<Link className="text-link account-back" href="/cuenta/direcciones">Mis direcciones →</Link><Link className="text-link account-back" href="/cuenta/pedidos">Mis pedidos →</Link><AccountSettings name={user.name} /><button className="button button-secondary" type="button" onClick={logout} disabled={busy}>{busy ? "CERRANDO SESIÓN…" : "CERRAR SESIÓN"}</button><Link className="account-back" href="/catalogo">Explorar el catálogo →</Link></>
      : <>{passwordUpdated && <p className="account-success" role="status">Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.</p>}<h1>{register ? "Crea tu cuenta." : "Bienvenido de nuevo."}</h1><p>{register ? "Regístrate para formar parte de Ok Family Store." : "Inicia sesión para acceder a tu cuenta."}</p>
      <form onSubmit={submit}>
        {register && <label>Nombre completo<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} /></label>}
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Contraseña<input name="password" type={show ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={128} /></label>
        {register && <><small>Usa al menos 12 caracteres.</small><label>Confirmar contraseña<input name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /></label></>}
        <button className="account-show" type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button>
        {error && <p role="alert" className="account-error">{error}</p>}
        <button className="button" type="submit" disabled={busy}>{busy ? "UN MOMENTO…" : register ? "CREAR MI CUENTA" : "INICIAR SESIÓN"}</button>
      </form>
      <p className="account-switch">{register ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"} <button type="button" onClick={() => {setRegister(!register); setError("");}}>{register ? "Inicia sesión" : "Regístrate"}</button></p></>}
    </div></section>;
}
