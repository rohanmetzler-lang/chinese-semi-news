"use client"

import { useEffect, useState } from "react"

type StockData = {
  price: number
  change: number
  marketCap: number | null
  currency: string
}

type Props = {
  companyId: number
  ticker: string
  exchange: string
  initialPrice?: number | null
  initialChange?: number | null
  initialMarketCap?: number | null
  initialCurrency?: string | null
  initialUpdatedAt?: string | null
}

export default function LiveStockTicker({
  companyId, ticker, exchange,
  initialPrice, initialChange, initialMarketCap, initialCurrency, initialUpdatedAt,
}: Props) {
  const [stock, setStock] = useState<StockData | null>(
    initialPrice ? { price: initialPrice, change: initialChange ?? 0, marketCap: initialMarketCap ?? null, currency: initialCurrency ?? "CNY" } : null
  )
  const [loading, setLoading] = useState(!initialPrice)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(initialUpdatedAt ? new Date(initialUpdatedAt) : null)

  useEffect(() => {
    fetch(`/api/companies/${companyId}/stock`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) {
          setStock(data)
          setUpdatedAt(new Date())
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [companyId])

  const currencySymbol = stock?.currency === "HKD" ? "HK$" : stock?.currency === "USD" ? "$" : "¥"

  if (!stock && !loading) return null

  return (
    <div className="flex items-center gap-6 mb-6 bg-gray-800/50 rounded-xl px-5 py-4">
      <div>
        <div className="text-xs text-gray-500 mb-1 font-mono">{exchange}:{ticker}</div>
        {loading ? (
          <div className="text-gray-500 text-sm animate-pulse">Fetching live price...</div>
        ) : stock ? (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">
              {currencySymbol}{stock.price.toFixed(2)}
            </span>
            <span className={`text-base font-semibold ${stock.change >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
            </span>
          </div>
        ) : null}
      </div>

      {stock?.marketCap && (
        <div className="border-l border-gray-700 pl-6">
          <div className="text-xs text-gray-500 mb-1">Market Cap</div>
          <div className="text-sm font-medium text-white">
            {stock.marketCap >= 1e12
              ? `${currencySymbol}${(stock.marketCap / 1e12).toFixed(2)}T`
              : stock.marketCap >= 1e9
              ? `${currencySymbol}${(stock.marketCap / 1e9).toFixed(2)}B`
              : `${currencySymbol}${(stock.marketCap / 1e6).toFixed(0)}M`}
          </div>
        </div>
      )}

      {updatedAt && (
        <div className="ml-auto text-xs text-gray-600">
          Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  )
}
