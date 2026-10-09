export type ProductType = "PRODUCTO" | "LOTE";
export type Availability = "DISPONIBLE" | "RESERVADO" | "VENDIDO";

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: "MXN";
  type: ProductType;
  category: string;
  availableQuantity: number;
  piecesPerUnit: number;
  availability: Availability;
  images: { url: string; alt: string }[];
  isDemo: boolean;
}

export interface CatalogResponse {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HealthResponse {
  service: string;
  status: "ok";
  timestamp: string;
}

export function getAvailability(availableQuantity: number, reservedQuantity: number): Availability {
  if (availableQuantity > 0) return "DISPONIBLE";
  return reservedQuantity > 0 ? "RESERVADO" : "VENDIDO";
}

export function formatMoney(amountInCents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountInCents / 100);
}
