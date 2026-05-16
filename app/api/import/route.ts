import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })

  const results = { created: 0, skipped: 0, errors: [] as string[] }

  for (const row of rows) {
    const nameEn = String(row["Name (English)"] ?? row["nameEn"] ?? row["name_en"] ?? row["Company"] ?? "").trim()
    if (!nameEn) { results.skipped++; continue }

    try {
      const categoryName = String(row["Category"] ?? row["category"] ?? "").trim() || null

      await prisma.company.create({
        data: {
          nameEn,
          nameZhSimplified: String(row["Name (Chinese Simplified)"] ?? row["nameZhSimplified"] ?? row["中文名"] ?? "").trim() || null,
          nameZhTraditional: String(row["Name (Chinese Traditional)"] ?? row["nameZhTraditional"] ?? "").trim() || null,
          namePinyin: String(row["Pinyin"] ?? row["namePinyin"] ?? "").trim() || null,
          description: String(row["Description"] ?? row["description"] ?? "").trim() || null,
          website: String(row["Website"] ?? row["website"] ?? "").trim() || null,
          ticker: String(row["Ticker"] ?? row["ticker"] ?? "").trim() || null,
          exchange: String(row["Exchange"] ?? row["exchange"] ?? "").trim() || null,
          city: String(row["City"] ?? row["city"] ?? "").trim() || null,
          province: String(row["Province"] ?? row["province"] ?? "").trim() || null,
          address: String(row["Address"] ?? row["address"] ?? "").trim() || null,
          foundedYear: Number(row["Founded"] ?? row["foundedYear"] ?? 0) || null,
          dataSource: "excel_import",
          ...(categoryName ? {
            category: {
              connectOrCreate: {
                where: { name: categoryName },
                create: { name: categoryName },
              },
            },
          } : {}),
        },
      })
      results.created++
    } catch (err: any) {
      if (err?.code === "P2002") {
        results.skipped++
      } else {
        results.errors.push(`Row "${nameEn}": ${err?.message ?? "Unknown error"}`)
      }
    }
  }

  return NextResponse.json(results)
}
