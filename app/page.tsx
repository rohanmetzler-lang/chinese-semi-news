import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Home() {
  const [companyCount, newsCount] = await Promise.all([
    prisma.company.count(),
    prisma.newsArticle.count(),
  ])

  const recentNews = await prisma.newsArticle.findMany({
    orderBy: { scrapedAt: "desc" },
    take: 5,
  })

  const top100 = await prisma.company.findMany({
    where: { isTop100: true },
    orderBy: { top100Rank: "asc" },
    take: 5,
    include: { category: true },
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-3">China Semiconductor Intelligence</h1>
        <p className="text-gray-400 text-lg">Real-time tracking of Chinese semiconductor companies and industry news.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        {[
          { label: "Companies tracked", value: companyCount.toLocaleString() },
          { label: "News articles", value: newsCount.toLocaleString() },
          { label: "Top 100 ranked", value: "100" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl font-bold text-red-400">{stat.value}</div>
            <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Recent News */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Latest News</h2>
            <Link href="/news" className="text-sm text-red-400 hover:text-red-300">View all →</Link>
          </div>
          <div className="space-y-3">
            {recentNews.length === 0 ? (
              <p className="text-gray-500 text-sm">No news yet. <Link href="/admin" className="text-red-400 hover:underline">Run the scraper →</Link></p>
            ) : (
              recentNews.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="text-white text-sm font-medium line-clamp-2">{article.title}</div>
                  <div className="text-gray-500 text-xs mt-1">{article.source} · {article.publishedAt?.toLocaleDateString() ?? "—"}</div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Top 100 Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Top 100 Companies</h2>
            <Link href="/companies?top100=true" className="text-sm text-red-400 hover:text-red-300">View all →</Link>
          </div>
          <div className="space-y-3">
            {top100.length === 0 ? (
              <p className="text-gray-500 text-sm">No companies yet. <Link href="/admin" className="text-red-400 hover:underline">Import your data →</Link></p>
            ) : (
              top100.map((company) => (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <span className="text-red-400 font-bold text-sm w-8">#{company.top100Rank}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{company.nameEn}</div>
                    <div className="text-gray-500 text-xs">{company.nameZhSimplified} · {company.category?.name ?? "Uncategorized"}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <Link href="/companies" className="bg-gray-900 border border-gray-800 hover:border-red-900 rounded-xl p-6 transition-colors">
          <div className="text-red-400 text-2xl mb-2">🏭</div>
          <div className="text-white font-semibold">Company Database</div>
          <div className="text-gray-400 text-sm mt-1">Search and filter all tracked companies</div>
        </Link>
        <Link href="/admin/import" className="bg-gray-900 border border-gray-800 hover:border-red-900 rounded-xl p-6 transition-colors">
          <div className="text-red-400 text-2xl mb-2">📥</div>
          <div className="text-white font-semibold">Import Data</div>
          <div className="text-gray-400 text-sm mt-1">Upload Excel or add companies manually</div>
        </Link>
        <Link href="/newsletter" className="bg-gray-900 border border-gray-800 hover:border-red-900 rounded-xl p-6 transition-colors">
          <div className="text-red-400 text-2xl mb-2">📰</div>
          <div className="text-white font-semibold">Newsletter</div>
          <div className="text-gray-400 text-sm mt-1">Generate bi-weekly industry digest</div>
        </Link>
      </div>
    </div>
  )
}
