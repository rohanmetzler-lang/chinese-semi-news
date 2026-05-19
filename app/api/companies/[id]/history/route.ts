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

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

// Parse Set-Cookie headers into a single Cookie string
function parseCookies(raw: string): string {
  return raw
    .split(/,(?=[^;]+=[^;]+;|[^;]+=)/)
    .map(c => c.split(";")[0].trim())
    .filter(c => c.includes("="))
    .join("; ")
}

async function getSessionCookieAndCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    // Step 1: hit Yahoo Finance homepage to get session cookies
    const homeRes = await fetch("https://finance.yahoo.com", {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.9", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    })

    const rawCookie = homeRes.headers.get("set-cookie") ?? ""
    const cookie = parseCookies(rawCookie)

    if (!cookie) return null

    // Step 2: get crumb using those cookies
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, "Cookie": cookie },
      signal: AbortSignal.timeout(5000),
    })

    if (!crumbRes.ok) return null
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes("{")) return null  // got JSON error instead

    return { cookie, crumb }
  } catch {
    return null
  }
}

async function fetchChart(symbol: string, range: string): Promise<any> {
  const session = await getSessionCookieAndCrumb()

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`,
  ]

  for (const base of endpoints) {
    const url = session ? `${base}&crumb=${encodeURIComponent(session.crumb)}` : base
    const headers: Record<string, string> = { "User-Agent": UA }
    if (session?.cookie) headers["Cookie"] = session.cookie

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (result?.timestamp?.length) return result
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
  const result = await fetchChart(symbol, range)

  if (!result) {
    return NextResponse.json({ error: "No data returned" }, { status: 502 })
  }

  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
  const meta = result.meta ?? {}

  const points = timestamps
    .map((t, i) => ({ time: t, value: closes[i] }))
    .filter(p => p.value != null) as { time: number; value: number }[]

  return NextResponse.json({
    symbol,
    currency: meta.currency ?? "CNY",
    currentPrice: meta.regularMarketPrice,
    points,
  })
}
