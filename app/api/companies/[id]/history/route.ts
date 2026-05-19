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

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
}

async function getCrumb(cookie: string): Promise<string | null> {
  try {
    const res = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...BROWSER_HEADERS, Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function fetchYahoo(symbol: string, range: string): Promise<any> {
  // Step 1: get a session cookie from the Yahoo Finance homepage
  const consentRes = await fetch("https://finance.yahoo.com", {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  })

  const setCookie = consentRes.headers.get("set-cookie") ?? ""
  // Extract A3 or other session cookies
  const cookieVal = setCookie
    .split(",")
    .map(c => c.split(";")[0].trim())
    .filter(c => c.includes("="))
    .join("; ")

  // Step 2: get crumb
  const crumb = await getCrumb(cookieVal)

  // Step 3: fetch chart data
  const params = new URLSearchParams({ interval: "1d", range, events: "div,splits" })
  if (crumb) params.set("crumb", crumb)

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { ...BROWSER_HEADERS, Cookie: cookieVal },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (result) return result
    } catch {
      continue
    }
  }
  return null
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

  try {
    const result = await fetchYahoo(symbol, range)
    if (!result) return NextResponse.json({ error: "No data returned" }, { status: 502 })

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
