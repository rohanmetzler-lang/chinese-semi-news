"use client"

import { useState, useRef } from "react"
import Link from "next/link"

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setResult(null)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/import", { method: "POST", body: formData })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: "Upload failed. Please try again." })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back to Admin</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Import Companies</h1>
      <p className="text-gray-400 text-sm mb-8">Upload an Excel (.xlsx) or CSV file. The importer recognizes common column names — see the expected format below.</p>

      {/* Expected format */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Expected Column Names</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-400 font-mono">
          {[
            ["Name (English)", "Required — company name in English"],
            ["Name (Chinese Simplified)", "Simplified Chinese name (中文名)"],
            ["Name (Chinese Traditional)", "Traditional Chinese name"],
            ["Pinyin", "Romanized pronunciation"],
            ["Category", "Industry segment (e.g. Memory, Logic, EDA)"],
            ["Ticker", "Stock ticker symbol"],
            ["Exchange", "SSE, SZSE, HKEX, NASDAQ, NYSE"],
            ["Website", "Company website URL"],
            ["City", "Headquarters city"],
            ["Province", "Province or state"],
            ["Address", "Full address"],
            ["Founded", "Year founded (e.g. 1987)"],
            ["Description", "Short description"],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <span className="text-red-400 shrink-0">{col}</span>
              <span className="text-gray-600">— {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-red-800 transition-colors mb-4"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-gray-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-400">Drop your Excel or CSV file here, or click to browse</p>
            <p className="text-gray-600 text-sm mt-1">.xlsx, .xls, .csv supported</p>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
      >
        {uploading ? "Importing..." : "Import Companies"}
      </button>

      {result && (
        <div className={`mt-6 p-5 rounded-xl border ${result.error ? "bg-red-950 border-red-800" : "bg-gray-900 border-gray-700"}`}>
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <div className="text-sm space-y-2">
              <p className="text-green-400 font-semibold text-base">Import complete</p>
              <p className="text-gray-300">✓ {result.created} companies created</p>
              <p className="text-gray-500">↷ {result.skipped} rows skipped (duplicates or empty)</p>
              {result.errors?.length > 0 && (
                <div>
                  <p className="text-yellow-400 mt-2">Errors ({result.errors.length}):</p>
                  <ul className="text-gray-400 text-xs mt-1 space-y-0.5">
                    {result.errors.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <Link href="/companies" className="inline-block mt-3 text-red-400 hover:underline">
                View all companies →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
