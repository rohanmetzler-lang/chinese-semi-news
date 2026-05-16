"use client"

import { useState } from "react"
import Link from "next/link"

export default function AdminPage() {
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<any>(null)
  const [categorizing, setCategorizing] = useState(false)
  const [categorizeResult, setCategorizeResult] = useState<any>(null)

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Admin Panel</h1>
      <p className="text-gray-400 text-sm mb-8">Manage data ingestion and system operations.</p>

      <div className="grid grid-cols-2 gap-6">
        {/* Import */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Import Companies</h2>
          <p className="text-gray-400 text-sm mb-4">Upload an Excel file or add companies manually.</p>
          <div className="flex flex-col gap-2">
            <Link href="/admin/import" className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg text-center transition-colors">
              Upload Excel / CSV
            </Link>
            <Link href="/admin/companies/new" className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg text-center transition-colors">
              Add Company Manually
            </Link>
          </div>
        </div>

        {/* News Scraper */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">News Scraper</h2>
          <p className="text-gray-400 text-sm mb-4">Fetch latest semiconductor news from RSS feeds.</p>
          <button
            onClick={runScraper}
            disabled={scraping}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {scraping ? "Scraping..." : "Run Scraper Now"}
          </button>
          {scrapeResult && (
            <div className="mt-4 text-xs">
              {scrapeResult.error ? (
                <p className="text-red-400">{scrapeResult.error}</p>
              ) : (
                <div className="text-gray-300 space-y-1">
                  <p className="text-green-400 font-medium">✓ {scrapeResult.added} articles added, {scrapeResult.skipped} skipped{scrapeResult.summarized ? `, ${scrapeResult.summarized} AI-summarized` : ""}</p>
                  {scrapeResult.sources?.map((s: string, i: number) => (
                    <p key={i} className="text-gray-500">{s}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Newsletter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Newsletter</h2>
          <p className="text-gray-400 text-sm mb-4">Generate a bi-weekly digest from recent news.</p>
          <Link href="/newsletter" className="block bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg text-center transition-colors">
            Manage Newsletters
          </Link>
        </div>

        {/* Top 100 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Top 100 Rankings</h2>
          <p className="text-gray-400 text-sm mb-4">Manage which companies are in the Top 100.</p>
          <Link href="/companies?top100=true" className="block bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg text-center transition-colors">
            View Top 100
          </Link>
        </div>

        {/* AI Categorization */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 col-span-2">
          <h2 className="text-lg font-semibold text-white mb-1">AI Auto-Categorize</h2>
          <p className="text-gray-400 text-sm mb-4">Use Claude to assign categories to uncategorized companies (up to 30 at a time).</p>
          <button
            onClick={runCategorize}
            disabled={categorizing}
            className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {categorizing ? "Categorizing..." : "Auto-Categorize with Claude"}
          </button>
          {categorizeResult && (
            <div className="mt-3 text-xs">
              {categorizeResult.error ? (
                <p className="text-red-400">{categorizeResult.error}</p>
              ) : (
                <p className="text-green-400 font-medium">
                  {categorizeResult.message ?? `✓ ${categorizeResult.updated} of ${categorizeResult.total} companies categorized`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
