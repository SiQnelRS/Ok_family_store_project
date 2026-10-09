import { Module } from "@nestjs/common";
import { createHttpApplication, healthModule, ServiceSecurityModule } from "@ok-family/service-kit";
import type { HttpApplicationOptions } from "@ok-family/service-kit";

@Module({ imports: [ServiceSecurityModule, healthModule("commerce-service")] })
class AppModule {}

export function createApp(options?: HttpApplicationOptions) {
  return createHttpApplication(AppModule, options);
}
