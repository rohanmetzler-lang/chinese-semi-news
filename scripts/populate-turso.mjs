import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@libsql/client"

const TURSO_URL = "libsql://chinese-semi-rmetz11.aws-us-west-2.turso.io"
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3Nzg5MTMyODQsImlkIjoiMDE5ZTJmN2QtNDEwMS03MDg3LWJhNDktNDRlNmM0NjEzMWI3IiwicmlkIjoiMDE1NGVkMzgtZDUyYy00YzgyLTkwYTgtNjY1ZDE3MTQxNDMzIn0.xgjnKmunLFem251jzOAb_TOCHscNHMyNT8f-mxs6AVVhQNey1xHpofYE1oSmcmYyydqQD7dLtkdJKXk3ib91CA"
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
const claude = new Anthropic({ apiKey: ANTHROPIC_KEY })

const SEGMENTS = [
  "foundry and wafer fabrication (SMIC, Hua Hong, CXMT, YMTC and similar)",
  "fabless chip design (HiSilicon, Unisoc, Loongson, Zhaoxin, Cambricon, Horizon Robotics and similar)",
  "memory semiconductors (YMTC, CXMT, GigaDevice, Ingenic and similar)",
  "semiconductor equipment manufacturers (NAURA, AMEC, Kingsemi and similar)",
  "semiconductor materials and chemicals suppliers",
  "OSAT packaging and testing (JCET, Tongfu Microelectronics, Tianshui Huatian and similar)",
  "power semiconductors and analog chips (StarPower, BYD Semiconductor, CRRC Times Electric and similar)",
  "RF, mixed-signal and display driver ICs",
  "EDA software, IP licensing and design services",
  "compound semiconductors, photonics and sensors",
]

function normalize(name) {
  return name.toLowerCase()
    .replace(/\b(co\.|ltd\.?|inc\.?|corp\.?|group|holdings?|semiconductor|technology|technologies|tech|microelectronics|electronics)\b/g, "")
    .replace(/[^a-z0-9]/g, "").trim()
}

async function fetchStockData(ticker, exchange) {
  if (!ticker || !exchange) return null
  let symbol = ticker.toUpperCase()
  const ex = exchange.toUpperCase()
  if (ex === "SSE" || ex === "SHANGHAI") symbol += ".SS"
  else if (ex === "SZSE" || ex === "SHENZHEN") symbol += ".SZ"
  else if (ex === "HKEX" || ex === "HK") symbol += ".HK"
  else if (/^\d{6}$/.test(symbol)) symbol = symbol.startsWith("6") ? `${symbol}.SS` : `${symbol}.SZ`
  else if (/^\d{4,5}$/.test(symbol)) symbol += ".HK"

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    const price = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose ?? meta.previousClose
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    return { price, change, marketCap: meta.marketCap ?? null, currency: meta.currency ?? "CNY" }
  } catch { return null }
}

async function getOrCreateCategory(name) {
  const existing = await db.execute({ sql: `SELECT id FROM Category WHERE name = ?`, args: [name] })
  if (existing.rows.length > 0) return existing.rows[0].id
  const res = await db.execute({ sql: `INSERT INTO Category (name) VALUES (?) RETURNING id`, args: [name] })
  return res.rows[0].id
}

async function scrapeSegment(segment, existingNames, existingZh, existingTickers) {
  console.log(`\n🔍 Scraping: ${segment.split("(")[0].trim()}...`)

  const response = await claude.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000,
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
    "address": "full street address",
    "city": "City",
    "province": "Province",
    "foundedYear": 2000,
    "employeeCount": 5000,
    "description": "2-3 sentence factual description covering what the company makes, its market position, key products or technologies, and any notable recent developments.",
    "category": "category name",
    "tags": ["tag1", "tag2"]
  }
]
Only include real companies you are confident about. Omit fields you are unsure of rather than guessing.`
    }],
  })

  const text = response.content.find(b => b.type === "text")?.text ?? ""
  if (response.stop_reason === "max_tokens") console.log("  ⚠️  Response truncated — increase max_tokens")

  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "")
  const jsonMatch = stripped.match(/\[[\s\S]*\]/)
  if (!jsonMatch) { console.log("  ⚠️  No JSON found, response start:", text.slice(0, 200)); return { created: 0, skipped: 0 } }

  let companies
  try { companies = JSON.parse(jsonMatch[0]) }
  catch (e) { console.log("  ⚠️  JSON parse failed:", e.message.slice(0, 100)); return { created: 0, skipped: 0 } }

  let created = 0, skipped = 0, stockFetched = 0

  for (const company of companies) {
    if (!company.nameEn) continue
    if (existingNames.has(normalize(company.nameEn))) { skipped++; continue }
    if (company.nameZhSimplified && existingZh.has(company.nameZhSimplified)) { skipped++; continue }
    if (company.ticker && existingTickers.has(company.ticker)) { skipped++; continue }

    const stock = await fetchStockData(company.ticker, company.exchange)
    if (stock) stockFetched++

    const categoryId = company.category ? await getOrCreateCategory(company.category) : null

    try {
      await db.execute({
        sql: `INSERT INTO Company (nameEn, nameZhSimplified, nameZhTraditional, namePinyin, ticker, exchange, website, address, city, province, foundedYear, employeeCount, description, tags, categoryId, stockPrice, stockChange, marketCap, stockCurrency, stockUpdatedAt, dataSource, updatedAt, createdAt)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        args: [
          company.nameEn,
          company.nameZhSimplified || null,
          company.nameZhTraditional || null,
          company.namePinyin || null,
          company.ticker || null,
          company.exchange || null,
          company.website || null,
          company.address || null,
          company.city || null,
          company.province || null,
          company.foundedYear || null,
          company.employeeCount || null,
          company.description || null,
          company.tags ? JSON.stringify(company.tags) : null,
          categoryId,
          stock?.price ?? null,
          stock?.change ?? null,
          stock?.marketCap ?? null,
          stock?.currency ?? null,
          stock ? new Date().toISOString() : null,
          "scraper",
        ],
      })
      existingNames.add(normalize(company.nameEn))
      if (company.nameZhSimplified) existingZh.add(company.nameZhSimplified)
      if (company.ticker) existingTickers.add(company.ticker)
      created++
    } catch (e) {
      skipped++
    }
  }

  console.log(`  ✓ ${created} created, ${skipped} skipped, ${stockFetched} stocks fetched`)
  return { created, skipped }
}

async function main() {
  console.log("🚀 Populating Turso with Chinese semiconductor companies...\n")

  // Load existing for dedup
  const existing = await db.execute("SELECT nameEn, nameZhSimplified, ticker FROM Company")
  const existingNames = new Set(existing.rows.map(r => normalize(String(r.nameEn ?? ""))))
  const existingZh = new Set(existing.rows.map(r => r.nameZhSimplified).filter(Boolean))
  const existingTickers = new Set(existing.rows.map(r => r.ticker).filter(Boolean))
  console.log(`Found ${existing.rows.length} existing companies in Turso`)

  let totalCreated = 0, totalSkipped = 0
  for (const segment of SEGMENTS) {
    const { created, skipped } = await scrapeSegment(segment, existingNames, existingZh, existingTickers)
    totalCreated += created
    totalSkipped += skipped
  }

  const finalCount = await db.execute("SELECT COUNT(*) as n FROM Company")
  console.log(`\n✅ Done! ${totalCreated} companies added, ${totalSkipped} skipped`)
  console.log(`📊 Total companies in Turso: ${finalCount.rows[0].n}`)
}

main().catch(console.error)
