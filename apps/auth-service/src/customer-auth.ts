import { Body, Controller, Get, Headers, HttpCode, Injectable, Module, Post, UnauthorizedException, ConflictException, BadRequestException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { randomBytes } from "node:crypto";
import { createDatabaseClient } from "@ok-family/database";
import { CustomerLoginDto, CustomerRegisterDto, CustomerProfileDto, CustomerPasswordDto, bearerToken, hashPassword, sessionHash, verifyPassword } from "@ok-family/service-kit";
@Injectable()
class CustomerAuthService implements OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;
  private get db() { return this.database ??= createDatabaseClient(); }
  private readonly dummyHash = "scrypt-v1$" + "0".repeat(32) + "$" + "0".repeat(128);
  private async createSession(user: {id: string; name: string; email: string; role: string; passwordHash: string | null}) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.db.customerSession.deleteMany({where: {expiresAt: {lte: new Date()}}});
    await this.db.$transaction(async (tx) => {
      const active = await tx.user.updateMany({where: {id: user.id, role: "CUSTOMER", isActive: true, passwordHash: user.passwordHash}, data: {isActive: true}});
      if (!active.count) throw new UnauthorizedException("El correo o la contraseña no son correctos.");
      await tx.customerSession.create({data: {tokenHash: sessionHash(token), userId: user.id, expiresAt}});
    });
    return {token, expiresAt: expiresAt.toISOString(), user: {id: user.id, name: user.name, email: user.email, role: user.role}};
  }
  async register(input: CustomerRegisterDto) {
    const passwordHash = await hashPassword(input.password);
    try {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const user = await this.db.$transaction(async (tx) => {
        const created = await tx.user.create({data: {email: input.email, name: input.name, passwordHash, role: "CUSTOMER"}});
        await tx.customerSession.create({data: {tokenHash: sessionHash(token), userId: created.id, expiresAt}});
        return created;
      });
      return {token, expiresAt: expiresAt.toISOString(), user: {id: user.id, name: user.name, email: user.email, role: user.role}};
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
        throw new ConflictException("No fue posible crear la cuenta. Si ya tienes una, inicia sesión.");
      throw error;
    }
  }
  async login(input: CustomerLoginDto) {
    const user = await this.db.user.findUnique({where: {email: input.email}});
    const valid = await verifyPassword(input.password, user?.passwordHash ?? this.dummyHash);
    if (!valid || !user || user.role !== "CUSTOMER" || !user.isActive) throw new UnauthorizedException("El correo o la contraseña no son correctos.");
    return this.createSession(user);
  }
  async session(authorization?: string) {
    const session = await this.db.customerSession.findUnique({where: {tokenHash: sessionHash(bearerToken(authorization))}, include: {user: true}});
    if (!session || session.expiresAt <= new Date() || session.user.role !== "CUSTOMER" || !session.user.isActive)
      throw new UnauthorizedException("Tu sesión terminó. Vuelve a ingresar.");
    const {id, name, email, role} = session.user; return {id, name, email, role};
  }
  async updateProfile(authorization: string | undefined, input: CustomerProfileDto) {
    const tokenHash = sessionHash(bearerToken(authorization));
    const result = await this.db.user.updateMany({
      where: {role: "CUSTOMER", isActive: true, customerSessions: {some: {tokenHash, expiresAt: {gt: new Date()}}}},
      data: {name: input.name},
    });
    if (result.count !== 1) throw new UnauthorizedException("Tu sesión terminó. Vuelve a ingresar.");
    return {ok: true};
  }
  async updatePassword(authorization: string | undefined, input: CustomerPasswordDto) {
    const tokenHash = sessionHash(bearerToken(authorization));
    const session = await this.db.customerSession.findUnique({where: {tokenHash}, include: {user: true}});
    if (!session || session.expiresAt <= new Date() || session.user.role !== "CUSTOMER" || !session.user.isActive)
      throw new UnauthorizedException("Tu sesión terminó. Vuelve a ingresar.");
    if (!session.user.passwordHash || !(await verifyPassword(input.currentPassword, session.user.passwordHash)))
      throw new BadRequestException("La contraseña actual no es correcta.");
    if (input.currentPassword === input.newPassword)
      throw new BadRequestException("La contraseña nueva debe ser diferente a la actual.");
    const passwordHash = await hashPassword(input.newPassword);
    await this.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {id: session.userId, role: "CUSTOMER", isActive: true, passwordHash: session.user.passwordHash, customerSessions: {some: {tokenHash, expiresAt: {gt: new Date()}}}},
        data: {passwordHash},
      });
      if (!updated.count) throw new UnauthorizedException("Tu sesión terminó o tus datos cambiaron. Vuelve a ingresar.");
      await tx.customerSession.deleteMany({where: {userId: session.userId}});
    });
    return {ok: true};
  }
  async logout(authorization?: string) {
    await this.db.customerSession.deleteMany({where: {tokenHash: sessionHash(bearerToken(authorization))}}); return {ok: true};
  }
  async onModuleDestroy() { await this.database?.$disconnect(); }
}
@Controller("auth/customer")
class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}
  @Post("register") @Throttle({default: {limit: 5, ttl: 60000}}) register(@Body() input: CustomerRegisterDto) { return this.auth.register(input); }
  @Post("login") @HttpCode(200) @Throttle({default: {limit: 5, ttl: 60000}}) login(@Body() input: CustomerLoginDto) { return this.auth.login(input); }
  @Get("session") session(@Headers("authorization") authorization?: string) { return this.auth.session(authorization); }
  @Post("profile") @HttpCode(200) updateProfile(@Headers("authorization") authorization: string | undefined, @Body() input: CustomerProfileDto) { return this.auth.updateProfile(authorization, input); }
  @Post("password") @HttpCode(200) @Throttle({default: {limit: 5, ttl: 60000}}) updatePassword(@Headers("authorization") authorization: string | undefined, @Body() input: CustomerPasswordDto) { return this.auth.updatePassword(authorization, input); }
  @Post("logout") @HttpCode(200) logout(@Headers("authorization") authorization?: string) { return this.auth.logout(authorization); }
}
@Module({controllers: [CustomerAuthController], providers: [CustomerAuthService]})
export class CustomerAuthModule {}
