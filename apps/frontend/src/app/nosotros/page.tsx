import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Conoce la historia, misión y visión de Ok Family Store, un negocio familiar de moda americana en Durango.",
};

export default function AboutPage() {
  return (
    <article className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <Image
          className="about-hero-image"
          src="/images/plaza-de-armas-durango.webp"
          alt="Vista panorámica de la Plaza de Armas y el centro histórico de Durango"
          width={2400}
          height={1488}
          sizes="100vw"
          preload
        />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="about-hero-content">
          <p className="about-hero-eyebrow">OK FAMILY STORE · DURANGO</p>
          <h1 id="about-title">Sobre nosotros</h1>
          <p>Una historia familiar que crece junto a las familias de Durango.</p>
        </div>
      </section>

      <section className="about-story shell" aria-labelledby="about-story-title">
        <div className="about-intro">
          <p className="about-kicker">NUESTRA HISTORIA</p>
          <h2 id="about-story-title">Moda americana con raíces familiares.</h2>
          <p>
            Fátima Rosales Serrano creció en una familia dedicada a la venta de
            ropa, calzado y artículos del hogar americanos. Desde joven conoció
            el trabajo detrás de las importaciones y, con esa experiencia, dio
            vida a Ok Family Store en Durango.
          </p>
        </div>

        <ol className="about-milestones" aria-label="Momentos importantes">
          <li className="about-milestone">
            <time dateTime="2017">2017</time>
            <div>
              <h3>La primera sucursal</h3>
              <p>
                En junio abrió sus puertas la primera tienda, en Prolongación
                Nazas: el inicio de un proyecto familiar para acercar productos
                americanos a la comunidad duranguense.
              </p>
            </div>
          </li>
          <li className="about-milestone">
            <time dateTime="2022">2022</time>
            <div>
              <h3>Una nueva etapa</h3>
              <p>
                La apertura de una segunda sucursal marcó el crecimiento de Ok
                Family Store y dio lugar a la matriz del negocio.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="about-purpose" aria-label="Misión y visión">
        <div className="shell about-purpose-grid">
          <article className="about-purpose-card">
            <p className="about-kicker">LO QUE NOS MUEVE</p>
            <h2>Misión</h2>
            <p>
              Acercar moda americana para mujeres, hombres y niños a las
              familias de Durango, con variedad y precios competitivos. Al
              ofrecer mercancía de liquidación o devolución, buscamos que más
              personas puedan encontrar prendas a su alcance y darles una nueva
              oportunidad.
            </p>
          </article>
          <article className="about-purpose-card">
            <p className="about-kicker">HACIA DÓNDE VAMOS</p>
            <h2>Visión</h2>
            <p>
              Seguir creciendo en la ciudad de Durango y acercar Ok Family Store
              a más zonas de la capital, para que más personas puedan acceder a
              sus productos.
            </p>
          </article>
        </div>
      </section>

      <section className="about-next-step shell" aria-labelledby="about-next-title">
        <div>
          <p className="about-kicker">DESCUBRE OK FAMILY STORE</p>
          <h2 id="about-next-title">Encuentra algo para tu familia o negocio.</h2>
        </div>
        <Link className="button" href="/catalogo">
          EXPLORAR EL CATÁLOGO <span aria-hidden="true">→</span>
        </Link>
      </section>
    </article>
  );
}