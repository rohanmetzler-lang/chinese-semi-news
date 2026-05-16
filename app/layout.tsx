import type { Metadata } from "next"
import { Geist } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "China Semiconductor Intelligence",
  description: "Database and news tracker for Chinese semiconductor companies",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <nav className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-8 sticky top-0 z-50">
          <Link href="/" className="text-lg font-bold text-red-400 tracking-tight">
            中芯情报 <span className="text-gray-400 font-normal text-sm">China Semi Intel</span>
          </Link>
          <Link href="/companies" className="text-sm text-gray-300 hover:text-white transition-colors">Companies</Link>
          <Link href="/news" className="text-sm text-gray-300 hover:text-white transition-colors">News</Link>
          <Link href="/newsletter" className="text-sm text-gray-300 hover:text-white transition-colors">Newsletter</Link>
          <Link href="/admin" className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors">Admin</Link>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  )
}
