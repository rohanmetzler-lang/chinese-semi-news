import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Number(searchParams.get("page") ?? 1)
  const pageSize = Number(searchParams.get("pageSize") ?? 50)
  const search = searchParams.get("search") ?? ""
  const category = searchParams.get("category") ?? ""
  const top100 = searchParams.get("top100") === "true"

  const where: any = {}

  if (search) {
    where.OR = [
      { nameEn: { contains: search } },
      { nameZhSimplified: { contains: search } },
      { nameZhTraditional: { contains: search } },
      { namePinyin: { contains: search } },
      { nameAliases: { contains: search } },
    ]
  }

  if (category) {
    where.category = { name: category }
  }

  if (top100) {
    where.isTop100 = true
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { category: true },
      orderBy: top100 ? { top100Rank: "asc" } : { nameEn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.company.count({ where }),
  ])

  return NextResponse.json({ companies, total })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const company = await prisma.company.create({
    data: {
      nameEn: body.nameEn,
      nameZhSimplified: body.nameZhSimplified ?? null,
      nameZhTraditional: body.nameZhTraditional ?? null,
      namePinyin: body.namePinyin ?? null,
      nameAliases: body.nameAliases ? JSON.stringify(body.nameAliases) : null,
      description: body.description ?? null,
      foundedYear: body.foundedYear ? Number(body.foundedYear) : null,
      employeeCount: body.employeeCount ? Number(body.employeeCount) : null,
      website: body.website ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      ticker: body.ticker ?? null,
      exchange: body.exchange ?? null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      isTop100: body.isTop100 ?? false,
      top100Rank: body.top100Rank ? Number(body.top100Rank) : null,
      dataSource: body.dataSource ?? "manual",
      ...(body.categoryName ? {
        category: {
          connectOrCreate: {
            where: { name: body.categoryName },
            create: { name: body.categoryName },
          },
        },
      } : {}),
    },
  })
  return NextResponse.json(company, { status: 201 })
}
