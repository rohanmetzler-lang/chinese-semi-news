import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function toTencentSymbol(ticker: string, exchange: string): string | null {
  const t = ticker.trim()
  const ex = exchange.trim().toUpperCase()

  if (ex === "SSE" || ex === "SHANGHAI") return `sh${t}`
  if (ex === "SZSE" || ex === "SHENZHEN") return `sz${t}`

  // Infer from ticker format
  if (/^\d{6}$/.test(t)) {
    return t.startsWith("6") ? `sh${t}` : `sz${t}`
  }

  return null  // HK and US not supported
}

function dateStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}

const RANGE_DAYS: Record<string, number> = {
  "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730,
}

async function fetchTencent(symbol: string, range: string): Promise<{ time: number; value: number }[] | null> {
  const days = RANGE_DAYS[range] ?? 180
  const startDate = dateStr(days)
  const endDate = dateStr(0)

  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?_var=kline_dayqfq&param=${symbol},day,${startDate},${endDate},${days + 10},qfq`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const text = await res.text()
    // Response is JSONP: kline_dayqfq={...}
    const jsonMatch = text.match(/=(\{.+\})$/)
    if (!jsonMatch) return null
    const data = JSON.parse(jsonMatch[1])

    const klines: string[][] = data?.data?.[symbol]?.qfqday ?? data?.data?.[symbol]?.day ?? []
    if (!klines.length) return null

    return klines.map(row => {
      // row: [date, open, close, high, low, volume]
      const time = Math.floor(new Date(row[0]).getTime() / 1000)
      const close = parseFloat(row[2])
      return { time, value: close }
    }).filter(p => !isNaN(p.value) && p.time > 0)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const range = new URL(req.url).searchParams.get("range") ?? "6mo"

  const company = await prisma.company.findUnique({
    where: { id: Number(id) },
    select: { ticker: true, exchange: true, stockCurrency: true },
  })
  if (!company?.ticker || !company?.exchange) {
    return NextResponse.json({ error: "No ticker" }, { status: 404 })
  }

  const symbol = toTencentSymbol(company.ticker, company.exchange)
  if (!symbol) {
    return NextResponse.json({ error: "Exchange not supported" }, { status: 404 })
  }

  const points = await fetchTencent(symbol, range)
  if (!points?.length) {
    return NextResponse.json({ error: "No price data" }, { status: 404 })
  }

  return NextResponse.json({
    symbol: `${company.exchange}:${company.ticker}`,
    currency: company.stockCurrency ?? "CNY",
    points,
  })
}
