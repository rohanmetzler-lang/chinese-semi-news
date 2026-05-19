"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

type Company = {
  id: number
  nameEn: string
  nameZhSimplified: string | null
  nameZhTraditional: string | null
  namePinyin: string | null
  ticker: string | null
  exchange: string | null
  city: string | null
  isTop100: boolean
  top100Rank: number | null
  category: { name: string } | null
  tags: string | null
}

type Category = { id: number; name: string }

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [top100Only, setTop100Only] = useState(false)
  const [loading, setLoading] = useState(true)
  const pageSize = 50

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(search && { search }),
      ...(selectedCategory && { category: selectedCategory }),
      ...(top100Only && { top100: "true" }),
    })
    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setCompanies(data.companies)
    setTotal(data.total)
    setLoading(false)
  }, [page, search, selectedCategory, top100Only])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])
  useEffect(() => {
    fetch("/api/companies/categories").then(r => r.json()).then(setCategories)
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Database</h1>
          <p className="text-gray-500 text-sm mt-1">{total.toLocaleString()} companies tracked</p>
        </div>
        <Link href="/admin/import" className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Add Companies
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name (English, Chinese, Pinyin)..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 bg-zinc-900 border border-white/15 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        <select
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setPage(1) }}
          className="bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-400"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 cursor-pointer hover:border-slate-300">
          <input type="checkbox" checked={top100Only} onChange={(e) => { setTop100Only(e.target.checked); setPage(1) }} className="accent-blue-400" />
          <span className="text-sm text-gray-300">Top 100 only</span>
        </label>
      </div>

      <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider bg-zinc-900">
              <th className="text-left px-4 py-3 w-12">Rank</th>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Chinese Name</th>
              <th className="text-left px-4 py-3">Ticker</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No companies found.</td></tr>
            ) : companies.map((company, i) => (
              <tr key={company.id} className={`border-b border-slate-50 hover:bg-blue-900/30/30 transition-colors ${i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/50"}`}>
                <td className="px-4 py-3">
                  {company.isTop100 ? <span className="text-blue-400 font-bold text-xs">#{company.top100Rank}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/companies/${company.id}`} className="text-white hover:text-blue-400 font-medium transition-colors">
                    {company.nameEn}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  <span title={company.nameZhTraditional ?? ""}>{company.nameZhSimplified ?? ""}</span>
                  {company.namePinyin && <span className="text-slate-300 text-xs ml-1">({company.namePinyin})</span>}
                </td>
                <td className="px-4 py-3">
                  {company.ticker ? (
                    <span className="font-mono text-emerald-400 text-xs bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800">
                      {company.exchange}:{company.ticker}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{company.category?.name ?? ""}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{company.city ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
