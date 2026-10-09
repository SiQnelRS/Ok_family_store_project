"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="shell empty-state" role="alert">
      <h1>Algo interrumpió la visita.</h1>
      <p>Intenta cargar la página nuevamente.</p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}
