import "reflect-metadata";
import { Controller, Get, Module, ValidationPipe } from "@nestjs/common";
import type { DynamicModule, INestApplication, LogLevel, Type } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { HealthResponse } from "@ok-family/shared";
import { config } from "dotenv";
import helmet from "helmet";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export * from "./admin-security.js";
export * from "./admin-validation.js";
export * from "./customer-validation.js";
export * from "./commerce-validation.js";
export * from "./admin-customer-validation.js";

export { CatalogQueryDto, ProductSlugDto } from "./validation.js";

export function loadEnvironment(): void {
  config({
    path: [resolve(process.cwd(), ".env"), fileURLToPath(new URL("../../../.env", import.meta.url))],
    quiet: true,
  });
}

export function readPort(variable: string, fallback: number): number {
  const raw = process.env[variable];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${variable} debe ser un puerto entre 1 y 65535.`);
  }
  return value;
}

export function serviceUrl(variable: string, fallback: string): string {
  const value = process.env[variable] ?? fallback;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${variable} debe contener el origen HTTP(S) del servicio, sin rutas ni credenciales.`);
  }
  return url.origin;
}

export function health(service: string): HealthResponse {
  return { service, status: "ok", timestamp: new Date().toISOString() };
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ServiceSecurityModule {}

export function healthModule(service: string): DynamicModule {
  @Controller("health")
  class HealthController {
    @Get()
    getHealth(): HealthResponse {
      return health(service);
    }
  }

  @Module({})
  class HealthModule {}

  return { module: HealthModule, controllers: [HealthController] };
}

export interface HttpApplicationOptions {
  logger?: false | LogLevel[];
  rawBody?: boolean;
  webOrigin?: string;
}

export async function createHttpApplication(
  rootModule: Type<unknown> | DynamicModule,
  options: HttpApplicationOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(rootModule, {
    rawBody: options.rawBody ?? false,
    logger: options.logger ?? ["error", "warn", "log"],
  });
  app.useBodyParser("json", { limit: "8mb" });
  app.use(helmet());
  app.use((request: { path: string }, response: { setHeader: (key: string, value: string) => void }, next: () => void) => {
    if (/^\/api\/(?:admin|shop|auth\/(?:admin|customer))(?:\/|$)/.test(request.path)) response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.enableCors({
    origin: options.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "HEAD", "OPTIONS"],
    credentials: false,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  }));
  app.enableShutdownHooks();
  return app;
}
