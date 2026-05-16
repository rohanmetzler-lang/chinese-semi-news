import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { claude } from "@/lib/claude"
import { fetchStockData } from "@/lib/stockFetch"

const SEGMENTS = [
  "foundry and wafer fabrication (SMIC, Hua Hong, CXMT, YMTC and similar)",
  "fabless chip design (HiSilicon, Unisoc, Loongson, Zhaoxin, Cambricon, Horizon Robotics and similar)",
  "memory semiconductors (YMTC, CXMT, GigaDevice, Ingenic and similar)",
  "semiconductor equipment manufacturers",
  "semiconductor materials and chemicals suppliers",
  "OSAT packaging and testing (JCET, Tongfu Microelectronics, Tianshui Huatian and similar)",
  "power semiconductors and analog chips (StarPower, BYD Semiconductor, CRRC Times Electric and similar)",
  "RF, mixed-signal and display driver ICs",
  "EDA software, IP licensing and design services",
  "compound semiconductors, photonics and sensors",
]

type CompanyProfile = {
  nameEn: string
  nameZhSimplified: string
  nameZhTraditional?: string
  namePinyin?: string
  ticker?: string
  exchange?: string
  website?: string
  address?: string
  city?: string
  province?: string
  foundedYear?: number
  employeeCount?: number
  description: string
  category: string
  tags?: string[]
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const segmentIndex = typeof body.segment === "number" ? body.segment : 0
  const segment = SEGMENTS[segmentIndex] ?? SEGMENTS[0]

  // Ask Claude for a batch of companies
  let companies: CompanyProfile[] = []
  try {
    const response = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      messages: [{
        role: "user",
        content: `You are a semiconductor industry analyst with deep knowledge of China's semiconductor ecosystem.

Generate a comprehensive list of 35-45 real Chinese semiconductor companies in the segment: **${segment}**.

For each company provide accurate, factual information. Include both well-known giants and smaller but significant players.

Return ONLY a valid JSON array with this exact structure:
[
  {
    "nameEn": "Company English name",
    "nameZhSimplified": "公司简体中文名",
    "nameZhTraditional": "公司繁體中文名",
    "namePinyin": "Gōngsī Pīnyīn Míng",
    "ticker": "ticker symbol if publicly listed, else omit",
    "exchange": "SSE, SZSE, HKEX, NASDAQ, or NYSE if listed, else omit",
    "website": "https://company.com",
    "address": "full street address in English",
    "city": "City",
    "province": "Province",
    "foundedYear": 2000,
    "employeeCount": 5000,
    "description": "2-3 sentence factual description covering what the company makes, its market position, key products or technologies, and any notable recent developments.",
    "category": "category name matching the segment",
    "tags": ["tag1", "tag2"]
  }
]

Only include real companies you are confident about. Omit fields you are unsure of rather than guessing.`,
      }],
    })

    const text = response.content.find(b => b.type === "text")
    if (text) {
      const jsonMatch = (text as any).text.match(/\[[\s\S]*\]/)
      if (jsonMatch) companies = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    return NextResponse.json({ error: "Claude API error", detail: String(e) }, { status: 500 })
  }

  if (companies.length === 0) {
    return NextResponse.json({ error: "No companies generated" }, { status: 500 })
  }

  // Load existing companies for dedup (by nameEn and ticker)
  const existing = await prisma.company.findMany({
    select: { nameEn: true, nameZhSimplified: true, ticker: true },
  })
  const existingNames = new Set(existing.map(c => normalize(c.nameEn)))
  const existingZh = new Set(existing.map(c => c.nameZhSimplified).filter(Boolean))
  const existingTickers = new Set(existing.map(c => c.ticker).filter(Boolean))

  const results = { created: 0, skipped: 0, stockUpdated: 0, segment, total: companies.length }

  for (const company of companies) {
    // Dedup checks
    if (existingNames.has(normalize(company.nameEn))) { results.skipped++; continue }
    if (company.nameZhSimplified && existingZh.has(company.nameZhSimplified)) { results.skipped++; continue }
    if (company.ticker && existingTickers.has(company.ticker)) { results.skipped++; continue }

    // Fetch stock data if listed
    let stockPrice: number | null = null
    let stockChange: number | null = null
    let marketCap: number | null = null
    let stockCurrency: string | null = null
    let stockUpdatedAt: Date | null = null

    if (company.ticker && company.exchange) {
      const stock = await fetchStockData(company.ticker, company.exchange)
      if (stock) {
        stockPrice = stock.price
        stockChange = stock.change
        marketCap = stock.marketCap
        stockCurrency = stock.currency
        stockUpdatedAt = new Date()
        results.stockUpdated++
      }
    }

    // Upsert category
    let categoryId: number | null = null
    if (company.category) {
      const cat = await prisma.category.upsert({
        where: { name: company.category },
        create: { name: company.category },
        update: {},
      })
      categoryId = cat.id
    }

    try {
      await prisma.company.create({
        data: {
          nameEn: company.nameEn,
          nameZhSimplified: company.nameZhSimplified || null,
          nameZhTraditional: company.nameZhTraditional || null,
          namePinyin: company.namePinyin || null,
          ticker: company.ticker || null,
          exchange: company.exchange || null,
          website: company.website || null,
          address: company.address || null,
          city: company.city || null,
          province: company.province || null,
          foundedYear: company.foundedYear || null,
          employeeCount: company.employeeCount || null,
          description: company.description || null,
          tags: company.tags ? JSON.stringify(company.tags) : null,
          categoryId,
          stockPrice,
          stockChange,
          marketCap,
          stockCurrency,
          stockUpdatedAt,
          dataSource: "scraper",
        },
      })
      results.created++
      existingNames.add(normalize(company.nameEn))
      if (company.nameZhSimplified) existingZh.add(company.nameZhSimplified)
      if (company.ticker) existingTickers.add(company.ticker)
    } catch {
      results.skipped++
    }
  }

  return NextResponse.json(results)
}

export async function GET() {
  return NextResponse.json(
    SEGMENTS.map((label, index) => ({ index, label }))
  )
}

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/\b(co\.|ltd\.?|inc\.?|corp\.?|group|holdings?|semiconductor|technology|technologies|tech|microelectronics|electronics)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}
