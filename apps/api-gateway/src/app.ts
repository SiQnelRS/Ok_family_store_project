import { adminGatewayModule } from "./admin.js";
import { Controller, Get, Inject, Module, Param, Query, ServiceUnavailableException } from "@nestjs/common";
import { CatalogQueryDto, createHttpApplication, health, healthModule, ProductSlugDto, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";
import { GATEWAY_CLIENT, GatewayClient } from "./catalog-client.js";
import type { GatewayDependencies } from "./catalog-client.js";

@Controller("products")
class ProductsController {
  constructor(@Inject(GATEWAY_CLIENT) private readonly client: GatewayClient) {}

  @Get()
  list(@Query() query: CatalogQueryDto) {
    return this.client.list(query);
  }

  @Get(":slug")
  detail(@Param() params: ProductSlugDto) {
    return this.client.detail(params.slug);
  }
}

@Controller("ready")
class ReadinessController {
  constructor(@Inject(GATEWAY_CLIENT) private readonly client: GatewayClient) {}

  @Get()
  async ready() {
    const checks = await this.client.readiness();
    if (Object.values(checks).some((status) => status !== "ok")) {
      throw new ServiceUnavailableException({ service: "api-gateway", status: "unavailable", checks });
    }
    return { ...health("api-gateway"), checks };
  }
}

@Module({})
class GatewayModule {}

export function createApp(dependencies: GatewayDependencies, options?: HttpApplicationOptions) {
  return createHttpApplication({
    module: GatewayModule,
    imports: [adminGatewayModule(dependencies), ServiceSecurityModule, healthModule("api-gateway")],
    controllers: [ProductsController, ReadinessController],
    providers: [{ provide: GATEWAY_CLIENT, useValue: new GatewayClient(dependencies) }],
  }, options);
}
