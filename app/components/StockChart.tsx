"use client"

import { useEffect, useRef, useState } from "react"

type Point = { time: number; value: number }

const RANGES = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
]

export default function StockChart({ companyId, currency }: { companyId: number; currency?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const [range, setRange] = useState("6mo")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [change, setChange] = useState<number | null>(null)
  const [chartReady, setChartReady] = useState(false)

  // Init chart once
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!containerRef.current) return
      const { createChart, ColorType, LineStyle } = await import("lightweight-charts")
      if (cancelled || !containerRef.current) return

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "#18181b" },
          textColor: "#9ca3af",
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.05)", style: LineStyle.Solid },
          horzLines: { color: "rgba(255,255,255,0.05)", style: LineStyle.Solid },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
        timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
        crosshair: { vertLine: { color: "#60a5fa" }, horzLine: { color: "#60a5fa" } },
        width: containerRef.current.clientWidth,
        height: 260,
      })

      const series = chart.addAreaSeries({
        lineColor: "#3b82f6",
        topColor: "rgba(59,130,246,0.15)",
        bottomColor: "rgba(59,130,246,0.01)",
        lineWidth: 2,
        priceLineVisible: false,
      })

      chartRef.current = chart
      seriesRef.current = series

      const observer = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      observer.observe(containerRef.current)

      setChartReady(true)
    }
    init()
    return () => {
      cancelled = true
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Fetch data whenever chart is ready or range changes
  useEffect(() => {
    if (!chartReady || !seriesRef.current) return
    setLoading(true)
    setError(false)

    fetch(`/api/companies/${companyId}/history?range=${range}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if (!data?.points?.length) { setError(true); setLoading(false); return }

        const sorted = [...data.points].sort((a: Point, b: Point) => a.time - b.time)
        const chartData = sorted.map((p: Point) => ({
          time: Math.floor(p.time) as any,
          value: p.value,
        }))

        seriesRef.current.setData(chartData)
        chartRef.current?.timeScale().fitContent()

        if (sorted.length >= 2) {
          const first = sorted[0].value
          const last = sorted[sorted.length - 1].value
          setChange(((last - first) / first) * 100)
          const isDown = last < first
          seriesRef.current.applyOptions({
            lineColor: isDown ? "#ef4444" : "#22c55e",
            topColor: isDown ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
            bottomColor: "rgba(0,0,0,0)",
          })
        }

        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [companyId, range, chartReady])

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          {change !== null && (
            <span className={`text-sm font-medium ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}% in period
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                range === r.value
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-gray-400 hover:bg-white/15"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ minHeight: 260 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
            <span className="text-gray-500 text-sm animate-pulse">Loading chart...</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
            <span className="text-gray-500 text-sm">No chart data available for this ticker</span>
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  )
}
