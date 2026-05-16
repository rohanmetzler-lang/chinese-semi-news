"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const EXCHANGES = ["SSE", "SZSE", "HKEX", "NASDAQ", "NYSE", "OTC", "Private"]

export default function NewCompanyPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    nameEn: "", nameZhSimplified: "", nameZhTraditional: "", namePinyin: "",
    description: "", website: "", ticker: "", exchange: "", city: "", province: "",
    address: "", foundedYear: "", categoryName: "", tags: "", isTop100: false, top100Rank: "",
  })

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.nameEn.trim()) { setError("English name is required."); return }
    setSaving(true)
    setError("")
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        foundedYear: form.foundedYear ? Number(form.foundedYear) : null,
        top100Rank: form.top100Rank ? Number(form.top100Rank) : null,
        dataSource: "manual",
      }
      const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("Failed to save")
      const company = await res.json()
      router.push(`/companies/${company.id}`)
    } catch (e: any) {
      setError(e.message ?? "Failed to save company.")
      setSaving(false)
    }
  }

  const input = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-700"

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm">← Back to Admin</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-6">Add New Company</h1>

      <div className="space-y-5">
        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Names</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">English Name *</label>
              <input className={input} value={form.nameEn} onChange={e => set("nameEn", e.target.value)} placeholder="e.g. SMIC International" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Simplified Chinese</label>
              <input className={input} value={form.nameZhSimplified} onChange={e => set("nameZhSimplified", e.target.value)} placeholder="e.g. 中芯国际" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Traditional Chinese</label>
              <input className={input} value={form.nameZhTraditional} onChange={e => set("nameZhTraditional", e.target.value)} placeholder="e.g. 中芯國際" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Pinyin</label>
              <input className={input} value={form.namePinyin} onChange={e => set("namePinyin", e.target.value)} placeholder="e.g. Zhōng Xīn Guójì" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <input className={input} value={form.categoryName} onChange={e => set("categoryName", e.target.value)} placeholder="e.g. Foundry, Memory, EDA" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Description</h2>
          <textarea
            className={`${input} h-24 resize-none`}
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Brief description of the company and what it does..."
          />
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Stock Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ticker</label>
              <input className={input} value={form.ticker} onChange={e => set("ticker", e.target.value)} placeholder="e.g. 688981" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Exchange</label>
              <select className={input} value={form.exchange} onChange={e => set("exchange", e.target.value)}>
                <option value="">Select exchange</option>
                {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Location</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">City</label>
              <input className={input} value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Shanghai" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Province</label>
              <input className={input} value={form.province} onChange={e => set("province", e.target.value)} placeholder="e.g. Shanghai" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Website</label>
              <input className={input} value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Other</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Founded Year</label>
              <input className={input} type="number" value={form.foundedYear} onChange={e => set("foundedYear", e.target.value)} placeholder="e.g. 2000" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tags (comma separated)</label>
              <input className={input} value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="e.g. AI, DRAM, mature node" />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isTop100} onChange={e => set("isTop100", e.target.checked)} className="accent-red-500" />
              <span className="text-sm text-gray-300">Include in Top 100</span>
            </label>
            {form.isTop100 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Rank:</span>
                <input className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-red-700" type="number" min="1" max="100" value={form.top100Rank} onChange={e => set("top100Rank", e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors">
            {saving ? "Saving..." : "Save Company"}
          </button>
          <Link href="/admin" className="px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors text-center">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
