import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function toYahooSymbol(ticker: string, exchange: string): string {
  const t = ticker.trim().toUpperCase()
  const ex = exchange.trim().toUpperCase()
  if (ex === "SSE" || ex === "SHANGHAI") return `${t}.SS`
  if (ex === "SZSE" || ex === "SHENZHEN") return `${t}.SZ`
  if (ex === "HKEX" || ex === "HKG" || ex === "HK") return `${t}.HK`
  if (/^\d{6}$/.test(t)) return t.startsWith("6") ? `${t}.SS` : `${t}.SZ`
  if (/^\d{4,5}$/.test(t)) return `${t}.HK`
  return t
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const range = new URL(req.url).searchParams.get("range") ?? "6mo"

  const company = await prisma.company.findUnique({
    where: { id: Number(id) },
    select: { ticker: true, exchange: true },
  })
  if (!company?.ticker || !company?.exchange) {
    return NextResponse.json({ error: "No ticker" }, { status: 404 })
  }

  const symbol = toYahooSymbol(company.ticker, company.exchange)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    const data = await res.json()

    const result = data?.chart?.result?.[0]
    if (!result) return NextResponse.json({ error: "No data" }, { status: 404 })

    const timestamps: number[] = result.timestamp ?? []
    const quotes = result.indicators?.quote?.[0] ?? {}
    const closes: (number | null)[] = quotes.close ?? []
    const meta = result.meta ?? {}

    const points = timestamps
      .map((t, i) => ({ time: t, value: closes[i] }))
      .filter(p => p.value !== null && p.value !== undefined) as { time: number; value: number }[]

    return NextResponse.json({
      symbol,
      currency: meta.currency ?? "CNY",
      currentPrice: meta.regularMarketPrice,
      points,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 })
  }
}
