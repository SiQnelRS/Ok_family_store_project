import { Body, CanActivate, ConflictException, Controller, ExecutionContext, Get, Injectable, Module, NotFoundException, Param, Patch, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "@ok-family/database";
import { AdminCustomerQueryDto, AdminCustomerStatusDto, AdminIdDto, bearerToken, sessionHash } from "@ok-family/service-kit";

@Injectable()
class CustomerAdministration implements OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;
  private get db() { return this.database ??= createDatabaseClient(); }
  async identify(authorization?: string) {
    const session = await this.db.adminSession.findUnique({where: {tokenHash: sessionHash(bearerToken(authorization))}, include: {user: true}});
    if (!session || session.expiresAt <= new Date() || session.user.role !== "ADMIN") throw new UnauthorizedException("Tu sesión de administración terminó.");
    return session.user.id;
  }
  async list(query: AdminCustomerQueryDto) {
    const where = {role: "CUSTOMER" as const, ...(query.q ? {OR: [{name: {contains: query.q, mode: "insensitive" as const}}, {email: {contains: query.q, mode: "insensitive" as const}}]} : {})};
    const pageSize = 12;
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({where, select: {id: true, name: true, email: true, phone: true, isActive: true, createdAt: true}, orderBy: [{createdAt: "desc"}, {id: "asc"}], skip: (query.page - 1) * pageSize, take: pageSize}),
      this.db.user.count({where}),
    ], {isolationLevel: "RepeatableRead"});
    return {items, total, page: query.page, pageSize};
  }
  async change(id: string, input: AdminCustomerStatusDto, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({where: {id, role: "CUSTOMER", isActive: input.expectedActive}, data: {isActive: input.active}});
      if (!result.count) {
        const customer = await tx.user.findFirst({where: {id, role: "CUSTOMER"}, select: {id: true}});
        if (!customer) throw new NotFoundException("Cliente no encontrado.");
        throw new ConflictException("El estado cambió. Actualiza la página e intenta nuevamente.");
      }
      if (!input.active) await tx.customerSession.deleteMany({where: {userId: id}});
      if (input.active !== input.expectedActive)
        await tx.customerStatusAudit.create({data: {customerId: id, actorId, active: input.active}});
      return {ok: true, active: input.active};
    });
  }
  async onModuleDestroy() { await this.database?.$disconnect(); }
}
@Injectable()
class CustomerAdminGuard implements CanActivate {
  constructor(private readonly service: CustomerAdministration) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{headers: {authorization?: string}; adminId?: string}>();
    request.adminId = await this.service.identify(request.headers.authorization);
    return true;
  }
}
@Controller("admin/customers")
@UseGuards(CustomerAdminGuard)
class AdminCustomersController {
  constructor(private readonly service: CustomerAdministration) {}
  @Get() list(@Query() query: AdminCustomerQueryDto) { return this.service.list(query); }
  @Patch(":id") change(@Param() params: AdminIdDto, @Body() input: AdminCustomerStatusDto, @Req() request: {adminId: string}) { return this.service.change(params.id, input, request.adminId); }
}
@Module({controllers: [AdminCustomersController], providers: [CustomerAdministration, CustomerAdminGuard]})
export class AdminCustomersModule {}
