"use client"

import { useEffect, useState } from "react"

type Newsletter = {
  id: number
  title: string
  period: string
  status: string
  createdAt: string
  content: string
}

export default function NewsletterPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [selected, setSelected] = useState<Newsletter | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/newsletter").then(r => r.json()).then(data => {
      setNewsletters(data)
      setLoading(false)
    })
  }, [])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const data = await res.json()
      setNewsletters(prev => [data, ...prev])
      setSelected(data)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Newsletters</h1>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-white/15 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {generating ? "Generating..." : "+ Generate New Issue"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : newsletters.length === 0 ? (
            <p className="text-gray-500 text-sm">No newsletters yet. Click "Generate New Issue" to create one.</p>
          ) : newsletters.map((nl) => (
            <button
              key={nl.id}
              onClick={() => setSelected(nl)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected?.id === nl.id
                  ? "bg-blue-900/30 border-blue-800 shadow-sm"
                  : "bg-zinc-900 border-white/10 shadow-sm hover:border-white/15"
              }`}
            >
              <div className="text-white text-sm font-medium line-clamp-2">{nl.title}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">{nl.period}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  nl.status === "sent"
                    ? "bg-emerald-900/30 text-emerald-400"
                    : "bg-amber-900/30 text-amber-400"
                }`}>
                  {nl.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="col-span-2">
          {selected ? (
            <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                <button
                  onClick={() => navigator.clipboard.writeText(selected.content)}
                  className="bg-white/10 hover:bg-white/15 text-gray-200 text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  Copy Markdown
                </button>
              </div>
              <div className="prose prose-slate prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans leading-relaxed">
                  {selected.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-12 text-center text-gray-500">
              <p>Select a newsletter to preview it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
