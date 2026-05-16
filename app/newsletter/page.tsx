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
          className="bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {generating ? "Generating..." : "+ Generate New Issue"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : newsletters.length === 0 ? (
            <p className="text-gray-500 text-sm">No newsletters yet. Click "Generate New Issue" to create one.</p>
          ) : newsletters.map((nl) => (
            <button
              key={nl.id}
              onClick={() => setSelected(nl)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                selected?.id === nl.id
                  ? "bg-red-950 border-red-800"
                  : "bg-gray-900 border-gray-800 hover:border-gray-600"
              }`}
            >
              <div className="text-white text-sm font-medium line-clamp-2">{nl.title}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500 text-xs">{nl.period}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  nl.status === "sent"
                    ? "bg-green-950 text-green-400"
                    : "bg-yellow-950 text-yellow-400"
                }`}>
                  {nl.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="col-span-2">
          {selected ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(selected.content)}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Copy Markdown
                  </button>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans leading-relaxed">
                  {selected.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
              <p>Select a newsletter to preview it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
