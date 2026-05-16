import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/\b(co\.|ltd\.?|inc\.?|corp\.?|group|holdings?|semiconductor|technology|technologies|tech|microelectronics|electronics)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

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

  // Load all existing companies for dedup
  const existing = await prisma.company.findMany({
    select: { id: true, nameEn: true, nameZhSimplified: true, ticker: true },
  })
  const byNormalizedName = new Map(existing.map(c => [normalize(c.nameEn), c]))
  const byZhName = new Map(existing.filter(c => c.nameZhSimplified).map(c => [c.nameZhSimplified!, c]))
  const byTicker = new Map(existing.filter(c => c.ticker).map(c => [c.ticker!.toUpperCase(), c]))

  const results = {
    created: 0,
    duplicates: 0,
    skipped: 0,
    errors: [] as string[],
    duplicateNames: [] as string[],
  }

  for (const row of rows) {
    const nameEn = String(row["Name (English)"] ?? row["nameEn"] ?? row["name_en"] ?? row["Company"] ?? "").trim()
    if (!nameEn) { results.skipped++; continue }

    const ticker = String(row["Ticker"] ?? row["ticker"] ?? "").trim().toUpperCase() || null
    const nameZh = String(row["Name (Chinese Simplified)"] ?? row["nameZhSimplified"] ?? row["中文名"] ?? "").trim() || null

    // Dedup: check normalized English name, Chinese name, ticker
    const isDuplicate =
      byNormalizedName.has(normalize(nameEn)) ||
      (nameZh && byZhName.has(nameZh)) ||
      (ticker && byTicker.has(ticker))

    if (isDuplicate) {
      results.duplicates++
      results.duplicateNames.push(nameEn)
      continue
    }

    try {
      const categoryName = String(row["Category"] ?? row["category"] ?? "").trim() || null

      const created = await prisma.company.create({
        data: {
          nameEn,
          nameZhSimplified: nameZh,
          nameZhTraditional: String(row["Name (Chinese Traditional)"] ?? row["nameZhTraditional"] ?? "").trim() || null,
          namePinyin: String(row["Pinyin"] ?? row["namePinyin"] ?? "").trim() || null,
          description: String(row["Description"] ?? row["description"] ?? "").trim() || null,
          website: String(row["Website"] ?? row["website"] ?? "").trim() || null,
          ticker: ticker || null,
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

      // Update dedup maps so later rows in the same file are also caught
      byNormalizedName.set(normalize(nameEn), created as any)
      if (nameZh) byZhName.set(nameZh, created as any)
      if (ticker) byTicker.set(ticker, created as any)

      results.created++
    } catch (err: any) {
      if (err?.code === "P2002") {
        results.duplicates++
        results.duplicateNames.push(nameEn)
      } else {
        results.errors.push(`Row "${nameEn}": ${err?.message ?? "Unknown error"}`)
      }
    }
  }

  return NextResponse.json(results)
}
