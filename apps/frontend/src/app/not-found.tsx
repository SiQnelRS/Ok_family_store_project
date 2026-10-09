import Link from "next/link";
export default function NotFound() {
  return (
    <section className="shell empty-state">
      <p className="eyebrow">PUBLICACIÓN NO ENCONTRADA</p>
      <h1>Este hallazgo ya no está aquí.</h1>
      <p>La publicación no existe o dejó de estar visible.</p>
      <Link className="button" href="/#catalogo">
        Explorar el catálogo ↗
      </Link>
    </section>
  );
}
