import "dotenv/config";
import { createDatabaseClient } from "../src/index.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Los ejemplos no se cargan en producción.");
}

const db = createDatabaseClient();
const examples = [
  {
    slug: "ejemplo-tenis-talla-25",
    image: {
      url: "/images/tenis_deportivos.webp",
      alt: "Fotografía de referencia de los tenis deportivos de ejemplo",
    },
    name: "Tenis deportivos · talla 25",
    description:
      "Publicación de demostración para una pieza única. Sustituye la descripción y las imágenes antes de publicar mercancía real.",
    priceInCents: 75000,
    category: "Calzado",
    type: "PRODUCTO" as const,
    piecesPerUnit: 1,
  },
  {
    slug: "ejemplo-lote-blusas-m",
    image: {
      url: "/images/lote_de_blusas.webp",
      alt: "Fotografía de referencia del lote de blusas de ejemplo",
    },
    name: "Lote de blusas · talla M",
    description:
      "Ejemplo de un lote indivisible con ocho blusas. El precio corresponde al lote completo, que constituye una sola unidad comercial.",
    priceInCents: 95000,
    category: "Ropa",
    type: "LOTE" as const,
    piecesPerUnit: 8,
  },
  {
    slug: "ejemplo-lampara-mesa",
    image: {
      url: "/images/lampara_de_mesa.jpg",
      alt: "Fotografía de referencia de la lámpara de mesa de ejemplo",
    },
    name: "Lámpara de mesa",
    description:
      "Artículo de ejemplo para explorar el catálogo. No representa una existencia real de la tienda.",
    priceInCents: 42000,
    category: "Hogar",
    type: "PRODUCTO" as const,
    piecesPerUnit: 1,
  },
];

try {
  for (const { image, ...example } of examples) {
    const product = await db.product.upsert({
      where: { slug: example.slug },
      update: {},
      create: {
        ...example,
        availableQuantity: 1,
        isDemo: true,
        published: true,
        images: { create: image },
      },
      include: { images: true },
    });
    // Completa las fotos de los ejemplos existentes sin duplicarlas ni sustituir fotos propias.
    if (product.isDemo && product.images.length === 0) {
      await db.productImage.create({
        data: { ...image, productId: product.id },
      });
    }
  }
  console.log(
    "Ejemplos listos. Las publicaciones existentes conservan sus datos y disponibilidad.",
  );
} finally {
  await db.$disconnect();
}
