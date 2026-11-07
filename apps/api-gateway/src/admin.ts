import {
  Body,
  Controller,
  Delete,
  DynamicModule,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  StreamableFile,
} from "@nestjs/common";
import {
  AdminIdDto,
  AdminLoginDto,
  AdminProductDto,
  AdminUpdateDto,
  AdminDeleteDto,
  AdminQueryDto,
  AdminUploadDto,
} from "@ok-family/service-kit";
import type { GatewayDependencies } from "./catalog-client.js";
const ADMIN_DEPS = Symbol("ADMIN_DEPS");
class AdminProxy {
  constructor(
    @Inject(ADMIN_DEPS) private readonly dependencies: GatewayDependencies,
  ) {}
  async json(
    service: "authUrl" | "catalogUrl",
    path: string,
    method: string,
    authorization?: string,
    body?: unknown,
  ) {
    let response: Response, value: { message?: unknown };
    try {
      response = await fetch(new URL(path, this.dependencies[service]), {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      value = (await response.json()) as { message?: unknown };
    } catch {
      throw new ServiceUnavailableException(
        "El servicio no está disponible. Intenta nuevamente.",
      );
    }
    if (!response.ok) {
      const allowed = [400, 401, 403, 404, 409, 413, 415, 429];
      const status = allowed.includes(response.status) ? response.status : 503;
      const message =
        status === 503
          ? "El servicio no está disponible. Intenta nuevamente."
          : Array.isArray(value.message)
            ? "Revisa los datos del formulario."
            : typeof value.message === "string"
              ? value.message
              : "No pudimos completar esta operación.";
      throw new HttpException(message, status);
    }
    return value;
  }
  async media(filename: string) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
      throw new HttpException("Fotografía no encontrada.", 404);
    try {
      const response = await fetch(
        new URL("/api/media/" + filename, this.dependencies.catalogUrl),
        { signal: AbortSignal.timeout(10000), redirect: "error" },
      );
      if (!response.ok)
        throw new HttpException(
          "Fotografía no encontrada.",
          response.status === 404 ? 404 : 503,
        );
      return new StreamableFile(Buffer.from(await response.arrayBuffer()), {
        type: "image/webp",
        disposition: "inline",
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("La foto no está disponible.");
    }
  }
}
@Controller("auth/admin")
class AuthProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Post("login") @HttpCode(200) login(@Body() input: AdminLoginDto) {
    return this.proxy.json(
      "authUrl",
      "/api/auth/admin/login",
      "POST",
      undefined,
      input,
    );
  }
  @Get("session") session(@Headers("authorization") token?: string) {
    return this.proxy.json("authUrl", "/api/auth/admin/session", "GET", token);
  }
  @Post("logout") @HttpCode(200) logout(
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json("authUrl", "/api/auth/admin/logout", "POST", token);
  }
}
@Controller("admin/products")
class ProductsProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Get() list(
    @Query() query: AdminQueryDto,
    @Headers("authorization") token?: string,
  ) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/products?" + params,
      "GET",
      token,
    );
  }
  @Get(":id") detail(
    @Param() params: AdminIdDto,
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/products/" + params.id,
      "GET",
      token,
    );
  }
  @Post() create(
    @Body() input: AdminProductDto,
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/products",
      "POST",
      token,
      input,
    );
  }
  @Patch(":id") update(
    @Param() params: AdminIdDto,
    @Body() input: AdminUpdateDto,
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/products/" + params.id,
      "PATCH",
      token,
      input,
    );
  }
  @Delete(":id") remove(
    @Param() params: AdminIdDto,
    @Body() input: AdminDeleteDto,
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/products/" + params.id,
      "DELETE",
      token,
      input,
    );
  }
}
@Controller("admin/images")
class ImagesProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Post() upload(
    @Body() input: AdminUploadDto,
    @Headers("authorization") token?: string,
  ) {
    return this.proxy.json(
      "catalogUrl",
      "/api/admin/images",
      "POST",
      token,
      input,
    );
  }
}
@Controller("media")
class MediaProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Get(":filename") read(@Param("filename") filename: string) {
    return this.proxy.media(filename);
  }
}
@Module({})
class AdminGatewayModule {}
export function adminGatewayModule(
  dependencies: GatewayDependencies,
): DynamicModule {
  return {
    module: AdminGatewayModule,
    controllers: [
      AuthProxyController,
      ProductsProxyController,
      ImagesProxyController,
      MediaProxyController,
    ],
    providers: [AdminProxy, { provide: ADMIN_DEPS, useValue: dependencies }],
  };
}
