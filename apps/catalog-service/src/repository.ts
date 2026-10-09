import { createDatabaseClient } from "@ok-family/database";
import type { Prisma } from "@ok-family/database";
import { getAvailability } from "@ok-family/shared";
import type { CatalogResponse, ProductSummary } from "@ok-family/shared";
import type { CatalogQueryDto } from "@ok-family/service-kit";
import type { OnModuleDestroy } from "@nestjs/common";

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");

export interface CatalogRepository {
  list(query: CatalogQueryDto): Promise<CatalogResponse>;
  findBySlug(slug: string): Promise<ProductSummary | null>;
  ready(): Promise<void>;
}

type ProductWithImages = Prisma.ProductGetPayload<{ include: { images: true } }>;

export function toProductSummary(product: ProductWithImages): ProductSummary {
  if (product.currency !== "MXN") throw new Error("Unsupported product currency");
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceInCents: product.priceInCents,
    currency: product.currency,
    type: product.type,
    category: product.category,
    availableQuantity: product.availableQuantity,
    piecesPerUnit: product.piecesPerUnit,
    availability: getAvailability(product.availableQuantity, product.reservedQuantity),
    images: product.images.map(({ url, alt }) => ({ url, alt })),
    isDemo: product.isDemo,
  };
}

export class PrismaCatalogRepository implements CatalogRepository, OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;

  // Opening the connection lazily keeps liveness available when PostgreSQL is down.
  private get db(): ReturnType<typeof createDatabaseClient> {
    return this.database ??= createDatabaseClient();
  }

  async list(query: CatalogQueryDto): Promise<CatalogResponse> {
    const where: Prisma.ProductWhereInput = {
      published: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.category ? { category: { equals: query.category, mode: "insensitive" } } : {}),
      ...(query.q ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
        ],
      } : {}),
    };
    const [products, total] = await this.db.$transaction([
      this.db.product.findMany({
        where,
        include: { images: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.product.count({ where }),
    ], { isolationLevel: "RepeatableRead" });
    return { items: products.map(toProductSummary), total, page: query.page, pageSize: query.pageSize };
  }

  async findBySlug(slug: string): Promise<ProductSummary | null> {
    const product = await this.db.product.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    return product ? toProductSummary(product) : null;
  }

  async ready(): Promise<void> {
    await this.db.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.database?.$disconnect();
  }
}
