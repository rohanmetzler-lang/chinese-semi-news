import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .trim()
}

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
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "buffer" })

  // Find the best sheet: prefer sheets with name-like columns, pick the one with most rows
  let rows: Record<string, any>[] = []
  let usedSheet = workbook.SheetNames[0]

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const candidate: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" })
    if (candidate.length === 0) continue
    const cols = Object.keys(candidate[0]).map(k => k.toLowerCase())
    // Prefer sheets that look like company data
    const looksLikeData =
      cols.some(c => c.includes("name") || c.includes("company") || c.includes("english") || c.includes("中文")) ||
      candidate.length > rows.length
    if (looksLikeData && candidate.length > rows.length) {
      rows = candidate
      usedSheet = sheetName
    }
  }

  // Fall back to largest sheet if nothing matched
  if (rows.length === 0) {
    for (const sheetName of workbook.SheetNames) {
      const candidate: Record<string, any>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" })
      if (candidate.length > rows.length) { rows = candidate; usedSheet = sheetName }
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "File is empty or could not be parsed", sheets: workbook.SheetNames }, { status: 400 })
  }

  const detectedColumns = Object.keys(rows[0])

  // Load all existing for matching
  const existing = await prisma.company.findMany({
    select: { id: true, nameEn: true, nameZhSimplified: true, ticker: true },
  })
  const byNormalizedName = new Map(existing.map(c => [normalize(c.nameEn), c.id]))
  const byZhName = new Map(existing.filter(c => c.nameZhSimplified).map(c => [c.nameZhSimplified!, c.id]))
  const byTicker = new Map(existing.filter(c => c.ticker).map(c => [c.ticker!.toUpperCase(), c.id]))

  // Track names seen in this file to catch intra-file duplicates
  const seenInFile = new Set<string>()

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    detectedColumns,
    usedSheet,
    totalRows: rows.length,
  }

  for (const row of rows) {
    const nameEn =
      findCol(row, "Name (English)", "nameEn", "name_en", "English Name", "Company", "Company Name", "name") ||
      String(Object.values(row)[0] ?? "").trim()

    if (!nameEn) { results.skipped++; continue }
    if (seenInFile.has(normalize(nameEn))) { results.skipped++; continue }
    seenInFile.add(normalize(nameEn))

    const ticker = findCol(row, "Ticker", "ticker", "Stock Code", "stockCode", "symbol").toUpperCase() || null
    const nameZh = findCol(row, "Name (Chinese Simplified)", "nameZhSimplified", "中文名", "Chinese Name", "nameZh", "chinese") || null
    const categoryName = findCol(row, "Category", "category", "Segment", "sector", "Industry") || null
    const website = ensureUrl(findCol(row, "Website", "website", "URL", "url", "Homepage", "homepage")) || null
    const foundedYear = Number(findCol(row, "Founded", "foundedYear", "founded_year", "Year Founded", "Established")) || null
    const employeeCount = Number(findCol(row, "Employees", "employeeCount", "employee_count", "Headcount", "Staff")) || null

    const data = {
      nameEn,
      nameZhSimplified: nameZh,
      nameZhTraditional: findCol(row, "Name (Chinese Traditional)", "nameZhTraditional", "Traditional") || null,
      namePinyin: findCol(row, "Pinyin", "namePinyin", "pinyin") || null,
      description: findCol(row, "Description", "description", "About", "Summary", "notes") || null,
      website,
      ticker: ticker || null,
      exchange: findCol(row, "Exchange", "exchange", "Stock Exchange", "market") || null,
      city: findCol(row, "City", "city", "HQ City", "hqcity", "Location") || null,
      province: findCol(row, "Province", "province", "State", "Region") || null,
      address: findCol(row, "Address", "address") || null,
      foundedYear,
      employeeCount,
      dataSource: "excel_import",
    }

    // Find existing match by ticker, Chinese name, or normalized English name
    const existingId =
      (ticker && byTicker.get(ticker)) ||
      (nameZh && byZhName.get(nameZh)) ||
      byNormalizedName.get(normalize(nameEn))

    const attempt = async () => {
      let categoryId: number | undefined = undefined
      if (categoryName) {
        const cat = await prisma.category.upsert({
          where: { name: categoryName },
          create: { name: categoryName },
          update: {},
        })
        categoryId = cat.id
      }

      if (existingId) {
        await prisma.company.update({
          where: { id: existingId },
          data: { ...data, ...(categoryId !== undefined ? { categoryId } : {}) },
        })
        results.updated++
        byNormalizedName.set(normalize(nameEn), existingId)
        if (nameZh) byZhName.set(nameZh, existingId)
        if (ticker) byTicker.set(ticker, existingId)
      } else {
        const created = await prisma.company.create({
          data: { ...data, ...(categoryId !== undefined ? { categoryId } : {}) },
        })
        byNormalizedName.set(normalize(nameEn), created.id)
        if (nameZh) byZhName.set(nameZh, created.id)
        if (ticker) byTicker.set(ticker, created.id)
        results.created++
      }
    }

    // Retry up to 3 times on SQLITE_BUSY
    let lastErr: any
    for (let i = 0; i < 3; i++) {
      try {
        await attempt()
        lastErr = null
        break
      } catch (err: any) {
        lastErr = err
        if (err?.message?.includes("SQLITE_BUSY") || err?.message?.includes("database is locked")) {
          await new Promise(r => setTimeout(r, 100 * (i + 1)))
        } else {
          break
        }
      }
    }
    if (lastErr) results.errors.push(`"${nameEn}": ${lastErr?.message?.slice(0, 80) ?? "Unknown error"}`)
  }

  return NextResponse.json(results)
}
