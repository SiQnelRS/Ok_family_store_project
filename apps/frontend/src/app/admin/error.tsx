"use client";
import Link from "next/link";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-failure">
      <h1>No pudimos cargar el panel.</h1>
      <p>
        Tus datos siguen guardados. Revisa que los servicios estén activos e
        intenta nuevamente.
      </p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
      <Link href="/admin/ingresar">Volver al acceso</Link>
    </section>
  );
}
