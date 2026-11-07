import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Injectable,
  Module,
  UnauthorizedException,
  ForbiddenException,
  HttpCode,
} from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { randomBytes } from "node:crypto";
import { createDatabaseClient } from "@ok-family/database";
import {
  AdminLoginDto,
  bearerToken,
  sessionHash,
  verifyPassword,
} from "@ok-family/service-kit";

@Injectable()
class AdminAuthService implements OnModuleDestroy {
  private database?: ReturnType<typeof createDatabaseClient>;
  private get db() {
    return (this.database ??= createDatabaseClient());
  }
  private readonly dummyHash =
    "scrypt-v1$" + "0".repeat(32) + "$" + "0".repeat(128);
  async login(input: AdminLoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    });
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!valid || !user || user.role !== "ADMIN")
      throw new UnauthorizedException(
        "El correo o la contraseña no son correctos.",
      );
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.db.adminSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.db.adminSession.create({
      data: { tokenHash: sessionHash(token), userId: user.id, expiresAt },
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  async session(authorization?: string) {
    const token = bearerToken(authorization);
    const session = await this.db.adminSession.findUnique({
      where: { tokenHash: sessionHash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date())
      throw new UnauthorizedException("Tu sesión terminó. Vuelve a ingresar.");
    if (session.user.role !== "ADMIN")
      throw new ForbiddenException(
        "Este acceso es exclusivo de administración.",
      );
    const { id, name, email, role } = session.user;
    return { id, name, email, role };
  }
  async logout(authorization?: string) {
    await this.db.adminSession.deleteMany({
      where: { tokenHash: sessionHash(bearerToken(authorization)) },
    });
    return { ok: true };
  }
  async onModuleDestroy() {
    await this.database?.$disconnect();
  }
}
@Controller("auth/admin")
class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}
  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() input: AdminLoginDto) {
    return this.auth.login(input);
  }
  @Get("session") session(@Headers("authorization") authorization?: string) {
    return this.auth.session(authorization);
  }
  @Post("logout") @HttpCode(200) logout(
    @Headers("authorization") authorization?: string,
  ) {
    return this.auth.logout(authorization);
  }
}
@Module({ controllers: [AdminAuthController], providers: [AdminAuthService] })
export class AdminAuthModule {}
