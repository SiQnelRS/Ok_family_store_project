import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

export { PrismaClient, Prisma } from "./generated/client.js";

export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) throw new Error("DATABASE_URL es obligatoria para conectar PostgreSQL.");
  const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 3000, statement_timeout: 5000, query_timeout: 6000 });
  return new PrismaClient({ adapter });
}

export { holdCatalogUnit, finishCatalogReservation } from "./reservations.js";
