// src/lib/prisma.ts
//
// Global Prisma client singleton.
//
// Next.js hot-reload in development creates a new module context on each
// file change, which would otherwise spawn a new PrismaClient — and exhaust
// the PostgreSQL connection pool. The globalThis trick pins a single instance
// across hot-reloads while production always gets exactly one instance.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
