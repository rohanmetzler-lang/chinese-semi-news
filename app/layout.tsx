import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: "China Semiconductor Intelligence",
  description: "Database and news tracker for Chinese semiconductor companies",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-black text-white">
        <nav className="border-b border-white/10 bg-black px-6 py-3 flex items-center gap-8 sticky top-0 z-50">
          <Link href="/" className="text-lg font-bold text-blue-500 tracking-tight">
            China Semiconductor Intelligence
          </Link>
          <Link href="/intelligence" className="text-sm text-gray-400 hover:text-blue-400 transition-colors">Intelligence</Link>
          <Link href="/companies" className="text-sm text-gray-400 hover:text-blue-400 transition-colors">Companies</Link>
          <Link href="/news" className="text-sm text-gray-400 hover:text-blue-400 transition-colors">News</Link>
          <Link href="/newsletter" className="text-sm text-gray-400 hover:text-blue-400 transition-colors">Newsletter</Link>
          <Link href="/admin" className="ml-auto text-sm text-gray-600 hover:text-blue-400 transition-colors">Admin</Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
