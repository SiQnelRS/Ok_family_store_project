import { BadGatewayException, BadRequestException, GatewayTimeoutException, HttpException, HttpStatus, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { CatalogQueryDto } from "@ok-family/service-kit";
import type { CatalogResponse, ProductSummary } from "@ok-family/shared";

export interface GatewayDependencies {
  catalogUrl: string;
  authUrl: string;
  commerceUrl: string;
  timeoutMs?: number;
}

export const GATEWAY_CLIENT = Symbol("GATEWAY_CLIENT");

export class GatewayClient {
  private readonly timeoutMs: number;

  constructor(private readonly dependencies: GatewayDependencies) {
    this.timeoutMs = dependencies.timeoutMs ?? 3_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30_000) {
      throw new Error("El timeout de servicios debe estar entre 1 y 30000 ms.");
    }
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.dependencies.catalogUrl), {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: "application/json" },
        redirect: "error",
      });
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        throw new GatewayTimeoutException("El catálogo tardó demasiado en responder.");
      }
      throw new ServiceUnavailableException("El catálogo no está disponible temporalmente.");
    }
    if (!response.ok) await response.body?.cancel();
    if (response.status === 404) throw new NotFoundException("Producto no encontrado.");
    if (response.status === 400) throw new BadRequestException("Consulta de catálogo inválida.");
    if (response.status === 429) {
      throw new HttpException("Demasiadas solicitudes. Intenta nuevamente en un momento.", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!response.ok) throw new ServiceUnavailableException("El catálogo no está disponible temporalmente.");
    try {
      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        throw new GatewayTimeoutException("El catálogo tardó demasiado en responder.");
      }
      throw new BadGatewayException("Respuesta inválida del catálogo.");
    }
  }

  list(query: CatalogQueryDto): Promise<CatalogResponse> {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.q) params.set("q", query.q);
    if (query.type) params.set("type", query.type);
    if (query.category) params.set("category", query.category);
    return this.request<CatalogResponse>(`/api/products?${params.toString()}`);
  }

  detail(slug: string): Promise<ProductSummary> {
    return this.request<ProductSummary>(`/api/products/${encodeURIComponent(slug)}`);
  }

  async readiness(): Promise<Record<string, "ok" | "unavailable">> {
    const dependencies = [
      ["auth", this.dependencies.authUrl, "/api/health"],
      ["catalog", this.dependencies.catalogUrl, "/api/ready"],
      ["commerce", this.dependencies.commerceUrl, "/api/health"],
    ] as const;
    const results = await Promise.all(dependencies.map(async ([name, base, path]) => {
      try {
        const response = await fetch(new URL(path, base), {
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { accept: "application/json" },
          redirect: "error",
        });
        const body = await response.json() as { status?: unknown };
        return [name, response.ok && body.status === "ok" ? "ok" : "unavailable"] as const;
      } catch {
        return [name, "unavailable"] as const;
      }
    }));
    return Object.fromEntries(results);
  }
}
