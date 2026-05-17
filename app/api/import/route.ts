import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/\b(co\.|ltd\.?|inc\.?|corp\.?|group|holdings?|semiconductor|technology|technologies|tech|microelectronics|electronics)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

// Fuzzy column finder — matches "Name (English)", "nameEn", "name_en", "Company Name", etc.
function findCol(row: Record<string, any>, ...candidates: string[]): string {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const c = candidate.toLowerCase().replace(/[^a-z0-9]/g, "")
    const match = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === c)
    if (match) return String(row[match] ?? "").trim()
  }
  return ""
}

function ensureUrl(url: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })

  if (rows.length === 0) {
    return NextResponse.json({ error: "File is empty or could not be parsed", columns: [] }, { status: 400 })
  }

  // Report detected columns so users can debug mismatches
  const detectedColumns = Object.keys(rows[0])

  // Load existing companies for dedup
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
    detectedColumns,
  }

  for (const row of rows) {
    // Flexible English name detection — fall back to first column value
    const nameEn =
      findCol(row, "Name (English)", "nameEn", "name_en", "English Name", "Company", "Company Name", "name") ||
      String(Object.values(row)[0] ?? "").trim()

    if (!nameEn) { results.skipped++; continue }

    const ticker = findCol(row, "Ticker", "ticker", "Stock Code", "stockCode", "symbol").toUpperCase() || null
    const nameZh =
      findCol(row, "Name (Chinese Simplified)", "nameZhSimplified", "中文名", "Chinese Name", "nameZh", "chinese") || null

    // Dedup
    if (byNormalizedName.has(normalize(nameEn))) {
      results.duplicates++; results.duplicateNames.push(nameEn); continue
    }
    if (nameZh && byZhName.has(nameZh)) {
      results.duplicates++; results.duplicateNames.push(nameEn); continue
    }
    if (ticker && byTicker.has(ticker)) {
      results.duplicates++; results.duplicateNames.push(nameEn); continue
    }

    const categoryName = findCol(row, "Category", "category", "Segment", "sector", "Industry") || null
    const website = ensureUrl(findCol(row, "Website", "website", "URL", "url", "Homepage", "homepage"))
    const foundedRaw = findCol(row, "Founded", "foundedYear", "founded_year", "Year Founded", "Established")
    const empRaw = findCol(row, "Employees", "employeeCount", "employee_count", "Headcount", "Staff")

    try {
      const created = await prisma.company.create({
        data: {
          nameEn,
          nameZhSimplified: nameZh,
          nameZhTraditional: findCol(row, "Name (Chinese Traditional)", "nameZhTraditional", "Traditional") || null,
          namePinyin: findCol(row, "Pinyin", "namePinyin", "pinyin") || null,
          description: findCol(row, "Description", "description", "About", "Summary", "notes") || null,
          website: website || null,
          ticker: ticker || null,
          exchange: findCol(row, "Exchange", "exchange", "Stock Exchange", "market") || null,
          city: findCol(row, "City", "city", "HQ City", "hqcity", "Location") || null,
          province: findCol(row, "Province", "province", "State", "Region") || null,
          address: findCol(row, "Address", "address") || null,
          foundedYear: Number(foundedRaw) || null,
          employeeCount: Number(empRaw) || null,
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
      byNormalizedName.set(normalize(nameEn), created as any)
      if (nameZh) byZhName.set(nameZh, created as any)
      if (ticker) byTicker.set(ticker, created as any)
      results.created++
    } catch (err: any) {
      if (err?.code === "P2002") {
        results.duplicates++; results.duplicateNames.push(nameEn)
      } else {
        results.errors.push(`"${nameEn}": ${err?.message ?? "Unknown error"}`)
      }
    }
  }

  return NextResponse.json(results)
}
