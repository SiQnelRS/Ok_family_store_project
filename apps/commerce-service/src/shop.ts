import { PaymentsService, StripeWebhookController } from "./payments.js";
import { StripeClient } from "./stripe-client.js";
import { OrdersService, cartVersion } from "./orders.js";
import { localCoverage } from "./coverage.js";
import { BadRequestException, Body, CanActivate, ConflictException, Controller, Delete, ExecutionContext, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Req, ServiceUnavailableException, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "@ok-family/database";
import { AddressDto, CheckoutDto, AdminIdDto, bearerToken, CartItemDto, CartSlugDto, serviceUrl } from "@ok-family/service-kit";
import type { ProductSummary } from "@ok-family/shared";

type CustomerRequest = {headers: {authorization?: string}; customerId: string};
@Injectable()
class ShopService implements OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;
  private get db() { return this.database ??= createDatabaseClient(); }
  async identify(authorization?: string) {
    bearerToken(authorization);
    try {
      const response = await fetch(new URL("/api/auth/customer/session", serviceUrl("AUTH_SERVICE_URL", "http://127.0.0.1:4001")), {headers: {authorization: authorization!}, signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store"});
      if (response.status === 401 || response.status === 403) throw new UnauthorizedException("Inicia sesión para continuar.");
      if (!response.ok) throw new ServiceUnavailableException("No pudimos comprobar tu sesión.");
      const identity = await response.json() as {id: string; role: string};
      if (identity.role !== "CUSTOMER" || !/^[0-9a-f-]{36}$/i.test(identity.id)) throw new UnauthorizedException("Inicia sesión para continuar.");
      return identity.id;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("No pudimos comprobar tu sesión.");
    }
  }
  async product(slug: string): Promise<ProductSummary | null> {
    try {
      const response = await fetch(new URL("/api/products/" + encodeURIComponent(slug), serviceUrl("CATALOG_SERVICE_URL", "http://127.0.0.1:4002")), {signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store"});
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("catalog");
      return await response.json() as ProductSummary;
    } catch { throw new ServiceUnavailableException("No pudimos consultar el catálogo. Intenta nuevamente."); }
  }
  async cart(userId: string) {
    const items = await this.db.cartItem.findMany({where: {userId}, orderBy: [{createdAt: "asc"}, {id: "asc"}]});
    const rows = await Promise.all(items.map(async item => {
      const product = await this.product(item.slug);
      const validProduct = product?.id === item.productId ? product : null;
      return {slug: item.slug, quantity: item.quantity, product: validProduct, available: !!validProduct && validProduct.availableQuantity >= item.quantity};
    }));
    const subtotalInCents = rows.reduce((sum, item) => sum + (item.product ? item.product.priceInCents * item.quantity : 0), 0);
    return {items: rows, subtotalInCents, currency: "MXN", complete: rows.length > 0 && rows.every(item => item.available)};
  }
  async putCart(userId: string, input: CartItemDto) {
    const product = await this.product(input.slug);
    if (!product) throw new ConflictException("La publicación ya no está disponible.");
    try {
      await this.db.$transaction(async tx => {
        const count = await tx.cartItem.count({where: {userId}});
        const existing = await tx.cartItem.findUnique({where: {userId_slug: {userId, slug: input.slug}}});
        const quantity = input.add && existing?.productId === product.id ? existing.quantity + input.quantity : input.quantity;
        if (quantity > 1000 || product.availableQuantity < quantity) throw new ConflictException("La cantidad solicitada ya no está disponible.");
        if (!existing && count >= 30) throw new BadRequestException("Puedes agregar hasta 30 publicaciones al carrito.");
        await tx.cartItem.upsert({where: {userId_slug: {userId, slug: input.slug}}, create: {userId, slug: input.slug, productId: product.id, quantity}, update: {quantity, productId: product.id}});
      }, {isolationLevel: "Serializable"});
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034")
        throw new ConflictException("El carrito cambió. Intenta nuevamente.");
      throw error;
    }
    return {ok: true};
  }
  async removeCart(userId: string, slug: string) { await this.db.cartItem.deleteMany({where: {userId, slug}}); return {ok: true}; }
  async addresses(userId: string) {
    return this.db.address.findMany({where: {userId}, select: {id: true, label: true, recipientName: true, phone: true, street: true, number: true, neighborhood: true, postalCode: true, city: true, state: true, references: true}, orderBy: {createdAt: "desc"}});
  }
  async createAddress(userId: string, input: AddressDto) {
    const count = await this.db.address.count({where: {userId}});
    if (count >= 20) throw new BadRequestException("Puedes guardar hasta 20 direcciones.");
    const address = await this.db.address.create({data: {...input, references: input.references || null, userId}, select: {id: true}});
    return {id: address.id};
  }
  async updateAddress(userId: string, id: string, input: AddressDto) {
    const result = await this.db.address.updateMany({where: {id, userId}, data: {...input, references: input.references || null}});
    if (!result.count) throw new NotFoundException("Dirección no encontrada.");
    return {ok: true};
  }
  async removeAddress(userId: string, id: string) {
    const result = await this.db.address.deleteMany({where: {id, userId}});
    if (!result.count) throw new NotFoundException("Dirección no encontrada.");
    return {ok: true};
  }
  async coverage(userId: string, id: string) {
    const address = await this.db.address.findFirst({where: {id, userId}, select: {postalCode: true}});
    if (!address) throw new NotFoundException("Dirección no encontrada.");
    return localCoverage(address.postalCode);
  }
  async pickupQuote(userId: string) {
    const cart = await this.cart(userId);
    return {method: "pickup", status: cart.complete ? "available" : "cart_unavailable", version: cartVersion(cart.items), subtotalInCents: cart.subtotalInCents, shippingInCents: 0, totalInCents: cart.complete ? cart.subtotalInCents : null, currency: "MXN", complete: cart.complete};
  }
  async quote(userId: string, id: string) {
    const coverage = await this.coverage(userId, id);
    const cart = await this.cart(userId);
    if (coverage.status !== "available") return {status: coverage.status, version: cartVersion(cart.items), subtotalInCents: cart.subtotalInCents, complete: cart.complete};
    return {status: cart.complete ? "available" : "cart_unavailable", version: cartVersion(cart.items), subtotalInCents: cart.subtotalInCents, shippingInCents: coverage.priceInCents, totalInCents: cart.subtotalInCents + coverage.priceInCents!, currency: "MXN", complete: cart.complete};
  }
  async onModuleDestroy() { await this.database?.$disconnect(); }
}
@Injectable()
class CustomerGuard implements CanActivate {
  constructor(private readonly service: ShopService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    request.customerId = await this.service.identify(request.headers.authorization);
    return true;
  }
}
@Controller("shop")
@UseGuards(CustomerGuard)
class ShopController {
  constructor(private readonly shop: ShopService, private readonly orders: OrdersService, private readonly payments: PaymentsService) {}
  @Post("orders/:id/pay") pay(@Req() req: CustomerRequest, @Param() params: AdminIdDto) {return this.payments.start(req.customerId,params.id);}
  @Get("orders") listOrders(@Req() req: CustomerRequest) {return this.orders.list(req.customerId);}
  @Post("orders") checkout(@Req() req: CustomerRequest, @Body() input: CheckoutDto) {return this.orders.create(req.customerId, input);}
  @Post("orders/:id/cancel") cancel(@Req() req: CustomerRequest, @Param() params: AdminIdDto) {return this.orders.cancel(req.customerId, params.id);}
  @Get("cart") cart(@Req() req: CustomerRequest) { return this.shop.cart(req.customerId); }
  @Post("cart") put(@Req() req: CustomerRequest, @Body() input: CartItemDto) { return this.shop.putCart(req.customerId, input); }
  @Delete("cart/:slug") remove(@Req() req: CustomerRequest, @Param() input: CartSlugDto) { return this.shop.removeCart(req.customerId, input.slug); }
  @Get("addresses") addresses(@Req() req: CustomerRequest) { return this.shop.addresses(req.customerId); }
  @Post("addresses") create(@Req() req: CustomerRequest, @Body() input: AddressDto) { return this.shop.createAddress(req.customerId, input); }
  @Patch("addresses/:id") update(@Req() req: CustomerRequest, @Param() params: AdminIdDto, @Body() input: AddressDto) { return this.shop.updateAddress(req.customerId, params.id, input); }
  @Delete("addresses/:id") delete(@Req() req: CustomerRequest, @Param() params: AdminIdDto) { return this.shop.removeAddress(req.customerId, params.id); }
  @Get("addresses/:id/quote") quote(@Req() req: CustomerRequest, @Param() params: AdminIdDto) { return this.shop.quote(req.customerId, params.id); }
  @Get("pickup/quote") pickupQuote(@Req() req: CustomerRequest) { return this.shop.pickupQuote(req.customerId); }
  @Get("addresses/:id/coverage") coverage(@Req() req: CustomerRequest, @Param() params: AdminIdDto) { return this.shop.coverage(req.customerId, params.id); }
}
@Module({controllers: [ShopController, StripeWebhookController], providers: [StripeClient, PaymentsService, ShopService, CustomerGuard, OrdersService]})
export class ShopModule {}
