export default function Loading() {
  return (
    <section className="shell empty-state" role="status" aria-live="polite">
      <span className="empty-symbol" aria-hidden="true">
        ✳
      </span>
      <p>Estamos preparando los hallazgos…</p>
    </section>
  );
}
