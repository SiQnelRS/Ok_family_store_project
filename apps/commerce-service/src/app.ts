import { AdminOrdersModule } from "./admin-orders.js";
import { ShopModule } from "./shop.js";
import { Module } from "@nestjs/common";
import { createHttpApplication, healthModule, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";

@Module({ imports: [AdminOrdersModule, ShopModule, ServiceSecurityModule, healthModule("commerce-service")] })
class AppModule {}

export function createApp(options?: HttpApplicationOptions) {
  return createHttpApplication(AppModule, {...options, rawBody:true});
}
