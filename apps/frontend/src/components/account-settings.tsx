"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountSettings({name}: {name: string}) {
  const router = useRouter();
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState<"name" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function updateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProfileError(""); setProfileMessage(""); setBusy("name");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/cuenta/profile", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({name: form.get("name")})});
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) { router.refresh(); return; }
        throw new Error(result.message || "No pudimos guardar tu nombre.");
      }
      setProfileMessage("Tu nombre se actualizó correctamente.");
      router.refresh();
    } catch (error) { setProfileError(error instanceof Error ? error.message : "Intenta nuevamente."); }
    finally { setBusy(null); }
  }
  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPasswordError("");
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) { setPasswordError("Las contraseñas nuevas no coinciden."); return; }
    setBusy("password");
    try {
      const response = await fetch("/api/cuenta/password", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword")})});
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) { router.refresh(); return; }
        throw new Error(result.message || "No pudimos cambiar tu contraseña.");
      }
      router.replace("/cuenta?password=actualizada"); router.refresh();
    } catch (error) { setPasswordError(error instanceof Error ? error.message : "Intenta nuevamente."); }
    finally { setBusy(null); }
  }
  return <>
    <section className="account-settings" aria-labelledby="profile-title">
      <h2 id="profile-title">Tu nombre</h2>
      <p>Así aparecerás en tu cuenta y en el panel de la tienda.</p>
      <form onSubmit={updateName}>
        <label>Nombre completo<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} defaultValue={name} /></label>
        {profileError && <p className="account-error" role="alert">{profileError}</p>}
        {profileMessage && <p className="account-success" role="status">{profileMessage}</p>}
        <button className="button button-secondary" disabled={busy !== null} type="submit">{busy === "name" ? "GUARDANDO…" : "GUARDAR NOMBRE"}</button>
      </form>
    </section>
    <section className="account-settings" aria-labelledby="password-title">
      <h2 id="password-title">Cambiar contraseña</h2>
      <p>Al cambiarla, se cerrarán tus sesiones y tendrás que ingresar de nuevo.</p>
      <form onSubmit={updatePassword}>
        <label>Contraseña actual<input name="currentPassword" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} /></label>
        <label>Contraseña nueva<input name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        <small>Usa al menos 12 caracteres.</small>
        <label>Confirmar contraseña nueva<input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        <button className="account-show" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button>
        {passwordError && <p className="account-error" role="alert">{passwordError}</p>}
        <button className="button" disabled={busy !== null} type="submit">{busy === "password" ? "GUARDANDO…" : "CAMBIAR CONTRASEÑA"}</button>
      </form>
    </section>
  </>;
}
