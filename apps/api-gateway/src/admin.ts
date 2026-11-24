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
  AddressDto,
  CartItemDto, CheckoutDto, OrderListDto, OrderChangeDto,
  CartSlugDto,
  AdminCustomerQueryDto,
  AdminCustomerStatusDto,
  AdminLoginDto,
  CustomerLoginDto,
  CustomerRegisterDto,
  CustomerProfileDto,
  CustomerPasswordDto,
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
    service: "authUrl" | "catalogUrl" | "commerceUrl",
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
@Controller("auth/customer")
class CustomerAuthProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Post("register") register(@Body() input: CustomerRegisterDto) { return this.proxy.json("authUrl", "/api/auth/customer/register", "POST", undefined, input); }
  @Post("login") @HttpCode(200) login(@Body() input: CustomerLoginDto) { return this.proxy.json("authUrl", "/api/auth/customer/login", "POST", undefined, input); }
  @Get("session") session(@Headers("authorization") token?: string) { return this.proxy.json("authUrl", "/api/auth/customer/session", "GET", token); }
  @Post("profile") @HttpCode(200) profile(@Headers("authorization") token: string | undefined, @Body() input: CustomerProfileDto) { return this.proxy.json("authUrl", "/api/auth/customer/profile", "POST", token, input); }
  @Post("password") @HttpCode(200) password(@Headers("authorization") token: string | undefined, @Body() input: CustomerPasswordDto) { return this.proxy.json("authUrl", "/api/auth/customer/password", "POST", token, input); }
  @Post("logout") @HttpCode(200) logout(@Headers("authorization") token?: string) { return this.proxy.json("authUrl", "/api/auth/customer/logout", "POST", token); }
}
@Controller("admin/orders")
class AdminOrdersProxy {
  constructor(private readonly proxy: AdminProxy) {}
  @Get() list(@Query() query: OrderListDto, @Headers("authorization") token?: string) {
    const params = new URLSearchParams({page:String(query.page ?? 1)});
    if(query.status) params.set("status",query.status);
    return this.proxy.json("commerceUrl","/api/admin/orders?"+params,"GET",token);
  }
  @Patch(":id") change(@Param() params: AdminIdDto, @Body() input: OrderChangeDto, @Headers("authorization") token?: string) {
    return this.proxy.json("commerceUrl","/api/admin/orders/"+params.id,"PATCH",token,input);
  }
}
@Controller("admin/customers")
class AdminCustomersProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Get() list(@Query() query: AdminCustomerQueryDto, @Headers("authorization") token?: string) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    return this.proxy.json("authUrl", "/api/admin/customers?" + params, "GET", token);
  }
  @Patch(":id") change(@Param() params: AdminIdDto, @Body() body: AdminCustomerStatusDto, @Headers("authorization") token?: string) { return this.proxy.json("authUrl", "/api/admin/customers/" + params.id, "PATCH", token, body); }
}
@Controller("shop")
class ShopProxyController {
  constructor(private readonly proxy: AdminProxy) {}
  @Get("orders") orders(@Headers("authorization") token?: string) {return this.proxy.json("commerceUrl", "/api/shop/orders", "GET", token);}
  @Post("orders") checkout(@Body() input: CheckoutDto, @Headers("authorization") token?: string) {return this.proxy.json("commerceUrl", "/api/shop/orders", "POST", token, input);}
  @Post("orders/:id/pay") pay(@Param() params: AdminIdDto, @Headers("authorization") token?: string) {return this.proxy.json("commerceUrl", "/api/shop/orders/" + params.id + "/pay", "POST", token, {});}
  @Post("orders/:id/cancel") cancel(@Param() params: AdminIdDto, @Headers("authorization") token?: string) {return this.proxy.json("commerceUrl", "/api/shop/orders/" + params.id + "/cancel", "POST", token, {});}
  @Get("cart") cart(@Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/cart", "GET", token); }
  @Post("cart") put(@Body() input: CartItemDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/cart", "POST", token, input); }
  @Delete("cart/:slug") remove(@Param() input: CartSlugDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/cart/" + input.slug, "DELETE", token); }
  @Get("addresses") addresses(@Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses", "GET", token); }
  @Post("addresses") create(@Body() input: AddressDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses", "POST", token, input); }
  @Patch("addresses/:id") update(@Param() params: AdminIdDto, @Body() input: AddressDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses/" + params.id, "PATCH", token, input); }
  @Delete("addresses/:id") delete(@Param() params: AdminIdDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses/" + params.id, "DELETE", token); }
  @Get("addresses/:id/quote") quote(@Param() params: AdminIdDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses/" + params.id + "/quote", "GET", token); }
  @Get("pickup/quote") pickupQuote(@Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/pickup/quote", "GET", token); }
  @Get("addresses/:id/coverage") coverage(@Param() params: AdminIdDto, @Headers("authorization") token?: string) { return this.proxy.json("commerceUrl", "/api/shop/addresses/" + params.id + "/coverage", "GET", token); }
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
      CustomerAuthProxyController,
      ShopProxyController,
      AdminOrdersProxy,
      AdminCustomersProxyController,
      ProductsProxyController,
      ImagesProxyController,
      MediaProxyController,
    ],
    providers: [AdminProxy, { provide: ADMIN_DEPS, useValue: dependencies }],
  };
}
