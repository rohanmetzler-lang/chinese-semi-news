"use client"

import { useState } from "react"
import Link from "next/link"

const SEGMENTS = [
  "Foundry & Wafer Fab",
  "Fabless Chip Design",
  "Memory",
  "Equipment",
  "Materials & Chemicals",
  "Packaging & Testing (OSAT)",
  "Power & Analog",
  "RF, Mixed-Signal & Display",
  "EDA, IP & Design Services",
  "Compound Semi, Photonics & Sensors",
]

export default function AdminPage() {
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<any>(null)
  const [categorizing, setCategorizing] = useState(false)
  const [categorizeResult, setCategorizeResult] = useState<any>(null)
  const [scrapingCompanies, setScrapingCompanies] = useState(false)
  const [companyScrapeResults, setCompanyScrapeResults] = useState<any[]>([])
  const [selectedSegments, setSelectedSegments] = useState<number[]>([])
  const [currentSegment, setCurrentSegment] = useState<string | null>(null)

  async function runCategorize() {
    setCategorizing(true)
    setCategorizeResult(null)
    try {
      const res = await fetch("/api/categorize", { method: "POST" })
      const data = await res.json()
      setCategorizeResult(data)
    } catch {
      setCategorizeResult({ error: "Categorization failed" })
    } finally {
      setCategorizing(false)
    }
  }

  async function runScraper() {
    setScraping(true)
    setScrapeResult(null)
    try {
      const res = await fetch("/api/scrape", { method: "POST" })
      const data = await res.json()
      setScrapeResult(data)
    } catch {
      setScrapeResult({ error: "Scraper failed" })
    } finally {
      setScraping(false)
    }
  }

  async function runCompanyScraper() {
    if (selectedSegments.length === 0) return
    setScrapingCompanies(true)
    setCompanyScrapeResults([])
    for (const segIndex of selectedSegments) {
      setCurrentSegment(SEGMENTS[segIndex])
      try {
        const res = await fetch("/api/companies/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segment: segIndex }),
        })
        const data = await res.json()
        setCompanyScrapeResults(prev => [...prev, { segment: SEGMENTS[segIndex], ...data }])
      } catch {
        setCompanyScrapeResults(prev => [...prev, { segment: SEGMENTS[segIndex], error: "Failed" }])
      }
    }
    setCurrentSegment(null)
    setScrapingCompanies(false)
  }

  function toggleSegment(i: number) {
    setSelectedSegments(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const totalCreated = companyScrapeResults.reduce((s, r) => s + (r.created ?? 0), 0)
  const totalSkipped = companyScrapeResults.reduce((s, r) => s + (r.skipped ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
      <p className="text-gray-500 text-sm mb-8">Manage data ingestion and system operations.</p>

      <div className="space-y-6">
        {/* Company Scraper */}
        <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Company Scraper</h2>
          <p className="text-gray-500 text-sm mb-4">
            Use Claude to auto-generate company profiles with names, addresses, descriptions, and live stock data.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {SEGMENTS.map((seg, i) => (
              <button
                key={i}
                onClick={() => toggleSegment(i)}
                disabled={scrapingCompanies}
                className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                  selectedSegments.includes(i)
                    ? "bg-blue-900/30 border-blue-700 text-blue-500"
                    : "bg-zinc-900 border-white/15 text-gray-400 hover:border-white/30"
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedSegments(SEGMENTS.map((_, i) => i))} disabled={scrapingCompanies} className="text-xs text-gray-500 hover:text-gray-200 transition-colors">Select all</button>
            <button onClick={() => setSelectedSegments([])} disabled={scrapingCompanies} className="text-xs text-gray-500 hover:text-gray-200 transition-colors">Clear</button>
            <button
              onClick={runCompanyScraper}
              disabled={scrapingCompanies || selectedSegments.length === 0}
              className="ml-auto bg-blue-500 hover:bg-blue-600 disabled:bg-white/15 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded-lg transition-colors"
            >
              {scrapingCompanies ? `Scraping: ${currentSegment ?? "..."}` : `Run Scraper (${selectedSegments.length} segment${selectedSegments.length !== 1 ? "s" : ""})`}
            </button>
          </div>
          {companyScrapeResults.length > 0 && (
            <div className="mt-4 space-y-1 text-xs border-t border-white/10 pt-4">
              <p className="text-emerald-600 font-medium mb-2">Total: {totalCreated} added, {totalSkipped} skipped</p>
              {companyScrapeResults.map((r, i) => (
                <div key={i} className="text-gray-400 flex justify-between">
                  <span>{r.segment}</span>
                  {r.error ? <span className="text-red-500">{r.error}</span> : <span>{r.created} added · {r.skipped} skipped · {r.stockUpdated} stocks</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Import Companies</h2>
            <p className="text-gray-500 text-sm mb-4">Upload Excel/CSV. Duplicates auto-detected by name and ticker.</p>
            <div className="flex flex-col gap-2">
              <Link href="/admin/import" className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg text-center transition-colors">Upload Excel / CSV</Link>
              <Link href="/admin/companies/new" className="bg-white/10 hover:bg-white/15 text-gray-200 text-sm px-4 py-2 rounded-lg text-center transition-colors">Add Company Manually</Link>
            </div>
          </div>

          <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">News Scraper</h2>
            <p className="text-gray-500 text-sm mb-4">Fetch latest semiconductor news. Claude summarizes each article.</p>
            <button onClick={runScraper} disabled={scraping} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-white/15 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {scraping ? "Scraping..." : "Run News Scraper"}
            </button>
            {scrapeResult && (
              <div className="mt-3 text-xs">
                {scrapeResult.error ? <p className="text-red-500">{scrapeResult.error}</p> : (
                  <div className="text-gray-400 space-y-0.5">
                    <p className="text-emerald-600 font-medium">✓ {scrapeResult.added} added, {scrapeResult.skipped} skipped{scrapeResult.summarized ? `, ${scrapeResult.summarized} AI-summarized` : ""}</p>
                    {scrapeResult.sources?.map((s: string, i: number) => <p key={i}>{s}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Newsletter</h2>
            <p className="text-gray-500 text-sm mb-4">Generate a bi-weekly digest from recent news.</p>
            <Link href="/newsletter" className="block bg-white/10 hover:bg-white/15 text-gray-200 text-sm px-4 py-2 rounded-lg text-center transition-colors">Manage Newsletters</Link>
          </div>

          <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">AI Auto-Categorize</h2>
            <p className="text-gray-500 text-sm mb-4">Claude assigns categories to uncategorized companies (30 at a time).</p>
            <button onClick={runCategorize} disabled={categorizing} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-white/15 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {categorizing ? "Categorizing..." : "Auto-Categorize with Claude"}
            </button>
            {categorizeResult && (
              <div className="mt-3 text-xs">
                {categorizeResult.error ? <p className="text-red-500">{categorizeResult.error}</p> : (
                  <p className="text-emerald-600 font-medium">{categorizeResult.message ?? `✓ ${categorizeResult.updated} of ${categorizeResult.total} categorized`}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
