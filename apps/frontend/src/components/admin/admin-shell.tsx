"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminIdentity } from "@ok-family/shared";

export function AdminShell({
  user,
  children,
}: {
  user: AdminIdentity;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error("No pudimos cerrar tu sesión. Intenta nuevamente.");
      router.replace("/admin/ingresar");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Intenta nuevamente.");
      setBusy(false);
    }
  }
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-wordmark">
          OK FAMILY
        </Link>
        <p className="admin-brand-caption">ADMINISTRACIÓN</p>
        <nav aria-label="Administración">
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
          >
            Mis productos
          </Link>
          <Link
            href="/admin/productos/nuevo"
            aria-current={pathname.endsWith("/nuevo") ? "page" : undefined}
          >
            Agregar producto
          </Link>
          <Link href="/admin/clientes" aria-current={pathname === "/admin/clientes" ? "page" : undefined}>Clientes</Link>
          <a href="/" target="_blank" rel="noreferrer">
            Ver mi tienda ↗
          </a>
          <a href="/admin#ayuda">Cómo usar el panel</a>
        </nav>
        <p className="admin-sidebar-note">
          Tu catálogo, a tu ritmo.
          <br />
          Los cambios guardados se reflejan en la tienda.
        </p>
      </aside>
      <div className="admin-main">
        <header className="admin-topline">
          <span>PANEL DE ADMINISTRACIÓN</span>
          <div>
            <span>{user.name}</span>
            <button type="button" onClick={logout} disabled={busy}>
              {busy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
