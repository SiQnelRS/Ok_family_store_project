import { AdminAuthModule } from "./admin-auth.js";
import { Module } from "@nestjs/common";
import { createHttpApplication, healthModule, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";

@Module({ imports: [AdminAuthModule, ServiceSecurityModule, healthModule("auth-service")] })
class AppModule {}

export function createApp(options?: HttpApplicationOptions) {
  return createHttpApplication(AppModule, options);
}
