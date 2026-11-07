"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "No pudimos iniciar sesión.");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Intenta nuevamente.");
      setBusy(false);
    }
  }
  return (
    <section className="admin-login">
      <Link href="/" className="admin-login-brand">
        OK FAMILY
      </Link>
      <div className="admin-card">
        <p className="admin-kicker">ADMINISTRACIÓN DE LA TIENDA</p>
        <h1>Bienvenido a tu negocio.</h1>
        <p className="admin-muted">
          Administra tus productos, fotografías y existencias desde un solo
          lugar.
        </p>
        <form onSubmit={submit}>
          <div className="admin-field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="password">Contraseña</label>
            <div className="admin-password">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-pressed={show}
              >
                {show ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          {error && (
            <p className="admin-alert" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Ingresando…" : "Entrar a mi panel →"}
          </button>
        </form>
      </div>
      <Link className="admin-back" href="/">
        ← Volver a la tienda
      </Link>
    </section>
  );
}
