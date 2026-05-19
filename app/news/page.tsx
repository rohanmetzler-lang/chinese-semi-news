import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; lang?: string }>
}) {
  const { page: pageStr, lang } = await searchParams
  const page = Number(pageStr ?? 1)
  const pageSize = 30

  const where: any = {}
  if (lang === "zh") where.language = "zh"
  if (lang === "en") where.language = "en"

  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: { scrapedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.newsArticle.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">News Feed</h1>
          <p className="text-gray-500 text-sm mt-1">{total.toLocaleString()} articles</p>
        </div>
        <a
          href="/admin"
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Run Scraper →
        </a>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { label: "All", value: "" },
          { label: "English", value: "en" },
          { label: "Chinese", value: "zh" },
        ].map(({ label, value }) => (
          <a
            key={value}
            href={`/news${value ? `?lang=${value}` : ""}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              (lang ?? "") === value
                ? "bg-blue-500 text-white"
                : "bg-zinc-900 border border-white/15 text-gray-300 hover:border-slate-300"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">No news articles yet.</p>
          <p className="text-sm">Go to the <a href="/admin" className="text-blue-400 hover:underline">Admin panel</a> and run the scraper.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-5 hover:border-blue-800 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-medium group-hover:text-blue-400 transition-colors line-clamp-2">
                    {article.title}
                  </h2>
                  {article.titleZh && (
                    <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{article.titleZh}</p>
                  )}
                  {article.summary && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">{article.summary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs font-medium text-gray-400 bg-white/10 px-2 py-0.5 rounded">
                      {article.source}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      article.language === "zh"
                        ? "bg-blue-900/30 text-blue-400"
                        : "bg-blue-900/30 text-blue-500"
                    }`}>
                      {article.language === "zh" ? "中文" : "EN"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {article.publishedAt?.toLocaleDateString() ?? article.scrapedAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm text-gray-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`/news?page=${page - 1}${lang ? `&lang=${lang}` : ""}`}
                className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/15 hover:border-slate-300">← Prev</a>
            )}
            {page < totalPages && (
              <a href={`/news?page=${page + 1}${lang ? `&lang=${lang}` : ""}`}
                className="px-3 py-1 rounded-lg bg-zinc-900 border border-white/15 hover:border-slate-300">Next →</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
