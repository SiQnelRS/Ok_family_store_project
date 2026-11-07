"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct } from "@ok-family/shared";
import { adminMutation, productPayload } from "../../lib/admin-client";

export function VisibilityButton({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await adminMutation("products/" + product.id, "PATCH", {
        ...productPayload(product),
        published: !product.published,
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="admin-text-button"
        onClick={toggle}
        disabled={busy}
        aria-label={
          (product.published ? "Ocultar " : "Mostrar ") + product.name
        }
      >
        {busy
          ? "Guardando…"
          : product.published
            ? "Ocultar"
            : "Mostrar en tienda"}
      </button>
      {error && (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function DeleteProductButton({ product }: { product: AdminProduct }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await adminMutation("products/" + product.id, "DELETE", {
        updatedAt: product.updatedAt,
      });
      dialog.current?.close();
      router.push("/admin?done=deleted");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Intenta nuevamente.");
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="admin-text-button admin-danger"
        type="button"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Eliminar producto
      </button>
      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-labelledby={"delete-title-" + product.id}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <h2 id={"delete-title-" + product.id}>¿Eliminar este producto?</h2>
        <p>
          <strong>{product.name}</strong> se borrará del catálogo. Esta acción
          no se puede deshacer.
        </p>
        <p className="admin-muted">
          Si solo quieres retirarlo temporalmente, puedes ocultarlo y conservar
          sus datos.
        </p>
        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        <div className="admin-dialog-actions">
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Conservar producto
          </button>
          <button
            className="button admin-delete-confirm"
            disabled={busy}
            onClick={remove}
          >
            {busy ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </dialog>
    </>
  );
}
export function ProductRowActions({ product }: { product: AdminProduct }) {
  return (
    <div className="admin-row-actions">
      <Link href={"/admin/productos/" + product.id}>Editar</Link>
      <VisibilityButton product={product} />
    </div>
  );
}
