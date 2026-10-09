import { Controller, Get, Inject, Module, NotFoundException, Param, Query, ServiceUnavailableException } from "@nestjs/common";
import { CatalogQueryDto, createHttpApplication, health, healthModule, ProductSlugDto, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";
import type { CatalogResponse, ProductSummary } from "@ok-family/shared";
import { CATALOG_REPOSITORY, PrismaCatalogRepository } from "./repository.js";
import type { CatalogRepository } from "./repository.js";

@Controller("products")
class ProductsController {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository) {}

  @Get()
  async list(@Query() query: CatalogQueryDto): Promise<CatalogResponse> {
    try {
      return await this.repository.list(query);
    } catch {
      throw new ServiceUnavailableException("El catálogo no está disponible temporalmente.");
    }
  }

  @Get(":slug")
  async detail(@Param() params: ProductSlugDto): Promise<ProductSummary> {
    let product: ProductSummary | null;
    try {
      product = await this.repository.findBySlug(params.slug);
    } catch {
      throw new ServiceUnavailableException("El catálogo no está disponible temporalmente.");
    }
    if (!product) throw new NotFoundException("Producto no encontrado.");
    return product;
  }
}

@Controller("ready")
class ReadinessController {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository) {}

  @Get()
  async ready() {
    try {
      await this.repository.ready();
      return { ...health("catalog-service"), checks: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({
        service: "catalog-service",
        status: "unavailable",
        checks: { database: "unavailable" },
      });
    }
  }
}

@Module({})
class CatalogModule {}

export function createApp(repository?: CatalogRepository, options?: HttpApplicationOptions) {
  return createHttpApplication({
    module: CatalogModule,
    imports: [ServiceSecurityModule, healthModule("catalog-service")],
    controllers: [ProductsController, ReadinessController],
    providers: [{
      provide: CATALOG_REPOSITORY,
      ...(repository ? { useValue: repository } : { useClass: PrismaCatalogRepository }),
    }],
  }, options);
}
