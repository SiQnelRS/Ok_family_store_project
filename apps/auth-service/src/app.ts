import { AdminCustomersModule } from "./admin-customers.js";
import { CustomerAuthModule } from "./customer-auth.js";
import { AdminAuthModule } from "./admin-auth.js";
import { Module } from "@nestjs/common";
import { createHttpApplication, healthModule, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";

@Module({ imports: [AdminCustomersModule, CustomerAuthModule, AdminAuthModule, ServiceSecurityModule, healthModule("auth-service")] })
class AppModule {}

export function createApp(options?: HttpApplicationOptions) {
  return createHttpApplication(AppModule, options);
}
