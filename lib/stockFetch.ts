export type StockData = {
  price: number
  change: number  // % change today
  marketCap: number | null
  currency: string
}

function toYahooSymbol(ticker: string, exchange: string): string | null {
  const t = ticker.trim().toUpperCase()
  const ex = exchange.trim().toUpperCase()
  if (ex === "SSE" || ex === "SHANGHAI") return `${t}.SS`
  if (ex === "SZSE" || ex === "SHENZHEN") return `${t}.SZ`
  if (ex === "HKEX" || ex === "HKG" || ex === "HK") return `${t}.HK`
  if (ex === "NASDAQ" || ex === "NYSE" || ex === "AMEX") return t
  // Try to infer from ticker length/format
  if (/^\d{6}$/.test(t)) {
    return t.startsWith("6") ? `${t}.SS` : `${t}.SZ`
  }
  if (/^\d{4,5}$/.test(t)) return `${t}.HK`
  return t  // assume US
}

export async function fetchStockData(ticker: string, exchange: string): Promise<StockData | null> {
  const symbol = toYahooSymbol(ticker, exchange)
  if (!symbol) return null

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()

    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null

    const price = meta.regularMarketPrice ?? meta.previousClose
    const prevClose = meta.chartPreviousClose ?? meta.previousClose
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    const marketCap = meta.marketCap ?? null
    const currency = meta.currency ?? "USD"

    if (!price) return null
    return { price, change, marketCap, currency }
  } catch {
    return null
  }
}
