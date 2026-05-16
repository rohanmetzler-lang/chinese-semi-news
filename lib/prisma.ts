import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"

function makeAdapter() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (url && authToken) {
    return new PrismaLibSql({ url, authToken })
  }

  // Local dev fallback
  const path = require("path")
  const dbPath = path.resolve(process.cwd(), "dev.db")
  return new PrismaLibSql({ url: `file:${dbPath}` })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: makeAdapter() } as any)

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
