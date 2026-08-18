// Cliente Prisma exportado para ser consumido pelo bot e pelo web.
// Re-exporta também os tipos gerados para facilitar o uso nos pacotes.

import { PrismaClient } from "@prisma/client";

// Em dev, reusa a mesma instância entre hot-reloads (tsx/Next) para não
// esgotar conexões do Postgres.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
