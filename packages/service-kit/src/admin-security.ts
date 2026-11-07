import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
  Injectable,
  Inject,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { AdminIdentity } from "@ok-family/shared";

// scrypt N=2^17, r=8, p=1; salt independiente por contraseña.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return (
    "scrypt-v1$" + salt + "$" + (await derive(password, salt)).toString("hex")
  );
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [version, salt, hash] = encoded.split("$");
  if (
    version !== "scrypt-v1" ||
    !salt ||
    !hash ||
    !/^[a-f0-9]{128}$/.test(hash)
  )
    return false;
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(await derive(password, salt), expected);
}
export function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function bearerToken(authorization?: string): string {
  if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
    throw new UnauthorizedException("Inicia sesión para continuar.");
  return authorization.slice(7);
}
export interface AdminRequest {
  headers: { authorization?: string };
  admin: AdminIdentity;
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject("ADMIN_AUTH_URL") private readonly authUrl: string) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    bearerToken(request.headers.authorization);
    let response: Response;
    try {
      response = await fetch(new URL("/api/auth/admin/session", this.authUrl), {
        headers: { authorization: request.headers.authorization! },
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
    } catch {
      throw new ServiceUnavailableException(
        "No podemos comprobar tu sesión. Intenta nuevamente.",
      );
    }
    if (response.status === 401)
      throw new UnauthorizedException("Tu sesión terminó. Vuelve a ingresar.");
    if (response.status === 403)
      throw new ForbiddenException(
        "Este acceso es exclusivo de administración.",
      );
    if (!response.ok)
      throw new ServiceUnavailableException("No podemos comprobar tu sesión.");
    const identity = (await response.json()) as AdminIdentity;
    if (identity.role !== "ADMIN")
      throw new ForbiddenException(
        "Este acceso es exclusivo de administración.",
      );
    request.admin = identity;
    return true;
  }
}
