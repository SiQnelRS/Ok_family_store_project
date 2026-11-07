import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createDatabaseClient, Prisma } from "@ok-family/database";
import type {
  AdminQueryDto,
  AdminProductDto,
  AdminUpdateDto,
} from "@ok-family/service-kit";
import { toProductSummary } from "./repository.js";
import type { AdminProduct } from "@ok-family/shared";

type Product = Prisma.ProductGetPayload<{ include: { images: true } }>;
const include = { images: { orderBy: { sortOrder: "asc" as const } } };
export function toAdminProduct(product: Product): AdminProduct {
  return {
    ...toProductSummary(product),
    published: product.published,
    reservedQuantity: product.reservedQuantity,
    soldQuantity: product.soldQuantity,
    updatedAt: product.updatedAt.toISOString(),
  };
}
function validate(input: AdminProductDto) {
  if (input.type === "PRODUCTO" && input.piecesPerUnit !== 1)
    throw new BadRequestException(
      "Un producto individual debe contener una pieza por unidad.",
    );
  if (input.type === "LOTE" && input.piecesPerUnit < 2)
    throw new BadRequestException("Un lote debe contener al menos dos piezas.");
  if (
    new Set(input.images.map((image) => image.url)).size !== input.images.length
  )
    throw new BadRequestException("No agregues la misma fotografía dos veces.");
  if (input.published && input.images.length === 0)
    throw new BadRequestException(
      "Agrega al menos una fotografía antes de mostrar el producto en la tienda.",
    );
}
function slugFor(name: string) {
  return (
    (name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 150) || "producto") +
    "-" +
    randomUUID().slice(0, 8)
  );
}
function auditValue(product: Product): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(toAdminProduct(product)),
  ) as Prisma.InputJsonValue;
}
function dataFor(input: AdminProductDto) {
  const {
    name,
    description,
    category,
    type,
    piecesPerUnit,
    priceInCents,
    availableQuantity,
    published,
    isDemo,
  } = input;
  return {
    name,
    description,
    category,
    type,
    piecesPerUnit,
    priceInCents,
    availableQuantity,
    published,
    isDemo,
  };
}
@Injectable()
export class AdminCatalogRepository implements OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;
  private get db() {
    return (this.database ??= createDatabaseClient());
  }
  private async operation<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002", "P2003"].includes(error.code)
      )
        throw new ConflictException(
          "El producto cambió o tiene movimientos asociados. Recarga la página; puedes ocultarlo de la tienda.",
        );
      throw new ServiceUnavailableException(
        "No pudimos guardar o consultar los productos. Intenta nuevamente.",
      );
    }
  }
  list(query: AdminQueryDto) {
    return this.operation(async () => {
      const where: Prisma.ProductWhereInput = {
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.category
          ? { category: { equals: query.category, mode: "insensitive" } }
          : {}),
        ...(query.status === "published"
          ? { published: true }
          : query.status === "draft"
            ? { published: false }
            : query.status === "out"
              ? { availableQuantity: 0 }
              : {}),
      };
      const [items, total, all, published, out, categories] =
        await this.db.$transaction(
          [
            this.db.product.findMany({
              where,
              include,
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              skip: (query.page - 1) * query.pageSize,
              take: query.pageSize,
            }),
            this.db.product.count({ where }),
            this.db.product.count(),
            this.db.product.count({ where: { published: true } }),
            this.db.product.count({ where: { availableQuantity: 0 } }),
            this.db.product.findMany({
              distinct: ["category"],
              select: { category: true },
              orderBy: { category: "asc" },
              take: 200,
            }),
          ],
          { isolationLevel: "RepeatableRead" },
        );
      return {
        items: items.map(toAdminProduct),
        total,
        page: query.page,
        pageSize: query.pageSize,
        counts: { all, published, hidden: all - published, out },
        categories: categories.map((row) => row.category),
      };
    });
  }
  detail(id: string) {
    return this.operation(async () => {
      const product = await this.db.product.findUnique({
        where: { id },
        include,
      });
      if (!product) throw new NotFoundException("Este producto ya no existe.");
      return toAdminProduct(product);
    });
  }
  create(input: AdminProductDto, actorId: string) {
    validate(input);
    return this.operation(() =>
      this.db.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            ...dataFor(input),
            slug: slugFor(input.name),
            images: {
              create: input.images.map((image, sortOrder) => ({
                ...image,
                sortOrder,
              })),
            },
          },
          include,
        });
        await tx.productAudit.create({
          data: {
            productId: product.id,
            actorId,
            action: "CREATE",
            after: auditValue(product),
          },
        });
        return toAdminProduct(product);
      }),
    );
  }
  update(id: string, input: AdminUpdateDto, actorId: string) {
    validate(input);
    return this.operation(() =>
      this.db.$transaction(
        async (tx) => {
          const previous = await tx.product.findUnique({
            where: { id },
            include,
          });
          if (!previous)
            throw new NotFoundException("Este producto ya no existe.");
          if (
            (previous.reservedQuantity ||
              previous.soldQuantity ||
              (await tx.reservationItem.count({ where: { productId: id } })) ||
              (await tx.orderItem.count({ where: { productId: id } }))) &&
            (previous.type !== input.type ||
              previous.piecesPerUnit !== input.piecesPerUnit)
          )
            throw new ConflictException(
              "Este producto tiene movimientos. Conserva su modalidad y la cantidad de piezas por unidad.",
            );
          const result = await tx.product.updateMany({
            where: { id, updatedAt: new Date(input.updatedAt) },
            data: dataFor(input),
          });
          if (result.count !== 1)
            throw new ConflictException(
              "Otra persona modificó este producto. Recarga la página antes de guardar.",
            );
          await tx.productImage.deleteMany({ where: { productId: id } });
          if (input.images.length)
            await tx.productImage.createMany({
              data: input.images.map((image, sortOrder) => ({
                ...image,
                sortOrder,
                productId: id,
              })),
            });
          const product = await tx.product.findUniqueOrThrow({
            where: { id },
            include,
          });
          await tx.productAudit.create({
            data: {
              productId: id,
              actorId,
              action: "UPDATE",
              before: auditValue(previous),
              after: auditValue(product),
            },
          });
          return toAdminProduct(product);
        },
        { isolationLevel: "Serializable" },
      ),
    );
  }
  remove(id: string, updatedAt: string, actorId: string) {
    return this.operation(() =>
      this.db.$transaction(
        async (tx) => {
          const product = await tx.product.findUnique({
            where: { id },
            include,
          });
          if (!product)
            throw new NotFoundException("Este producto ya no existe.");
          if (
            product.reservedQuantity ||
            product.soldQuantity ||
            (await tx.reservationItem.count({ where: { productId: id } })) ||
            (await tx.orderItem.count({ where: { productId: id } }))
          )
            throw new ConflictException(
              "Este producto tiene movimientos y debe conservarse. Usa la opción Ocultar para retirarlo de la tienda.",
            );
          const result = await tx.product.deleteMany({
            where: { id, updatedAt: new Date(updatedAt) },
          });
          if (result.count !== 1)
            throw new ConflictException(
              "El producto cambió. Recarga la página antes de eliminarlo.",
            );
          await tx.productAudit.create({
            data: {
              productId: id,
              actorId,
              action: "DELETE",
              before: auditValue(product),
            },
          });
          return { ok: true };
        },
        { isolationLevel: "Serializable" },
      ),
    );
  }
  async onModuleDestroy() {
    await this.database?.$disconnect();
  }
}
