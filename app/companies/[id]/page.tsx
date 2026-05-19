import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import LiveStockTicker from "@/app/components/LiveStockTicker"
import StockChart from "@/app/components/StockChart"

function ensureUrl(url: string | null): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      newsArticles: {
        include: { article: true },
        orderBy: { article: { scrapedAt: "desc" } },
        take: 10,
      },
    },
  })

  if (!company) notFound()

  const tags: string[] = company.tags ? JSON.parse(company.tags) : []
  const aliases: string[] = company.nameAliases ? JSON.parse(company.nameAliases) : []
  const websiteUrl = ensureUrl(company.website)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/companies" className="text-gray-500 hover:text-gray-200 text-sm transition-colors">← Back to companies</Link>
      </div>

      <div className="bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-8 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{company.nameEn}</h1>
            {company.nameZhSimplified && (
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span className="text-xl text-gray-300">{company.nameZhSimplified}</span>
                {company.nameZhTraditional && company.nameZhTraditional !== company.nameZhSimplified && (
                  <span className="text-gray-500 text-sm">({company.nameZhTraditional})</span>
                )}
                {company.namePinyin && (
                  <span className="text-gray-500 text-sm italic">{company.namePinyin}</span>
                )}
              </div>
            )}
            {aliases.length > 0 && (
              <div className="mt-1 text-gray-500 text-xs">Also known as: {aliases.join(", ")}</div>
            )}
          </div>
          {company.isTop100 && (
            <span className="bg-blue-900/30 border border-blue-800 text-blue-400 text-sm font-bold px-3 py-1 rounded-full shrink-0">
              Top 100 #{company.top100Rank}
            </span>
          )}
        </div>

        {company.description && (
          <p className="text-gray-300 leading-relaxed mb-6">{company.description}</p>
        )}

        {/* Live stock ticker */}
        {company.ticker && company.exchange && (
          <LiveStockTicker
            companyId={company.id}
            ticker={company.ticker}
            exchange={company.exchange}
            initialPrice={company.stockPrice}
            initialChange={company.stockChange}
            initialMarketCap={company.marketCap}
            initialCurrency={company.stockCurrency}
            initialUpdatedAt={company.stockUpdatedAt?.toISOString() ?? null}
          />
        )}

        {/* Stock chart */}
        {company.ticker && company.exchange && (
          <StockChart companyId={company.id} currency={company.stockCurrency} />
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mt-6">
          {company.category && (
            <div>
              <span className="text-gray-500">Category</span>
              <span className="ml-3 text-white">{company.category.name}</span>
            </div>
          )}
          {company.city && (
            <div>
              <span className="text-gray-500">Location</span>
              <span className="ml-3 text-white">{company.city}{company.province ? `, ${company.province}` : ""}</span>
            </div>
          )}
          {company.foundedYear && (
            <div>
              <span className="text-gray-500">Founded</span>
              <span className="ml-3 text-white">{company.foundedYear}</span>
            </div>
          )}
          {company.employeeCount && (
            <div>
              <span className="text-gray-500">Employees</span>
              <span className="ml-3 text-white">{company.employeeCount.toLocaleString()}</span>
            </div>
          )}
          {websiteUrl && (
            <div>
              <span className="text-gray-500">Website</span>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-3 text-blue-400 hover:underline">
                {websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </div>
          )}
          {company.address && (
            <div className="col-span-2">
              <span className="text-gray-500">Address</span>
              <span className="ml-3 text-white">{company.address}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="bg-white/10 border border-white/15 text-gray-300 text-xs px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Related News</h2>
        {company.newsArticles.length === 0 ? (
          <p className="text-gray-500 text-sm">No news articles linked to this company yet.</p>
        ) : (
          <div className="space-y-3">
            {company.newsArticles.map(({ article }) => (
              <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer"
                className="block bg-zinc-900 border border-white/10 shadow-sm rounded-xl p-4 hover:border-blue-800 hover:shadow-md transition-all">
                <div className="text-white text-sm font-medium">{article.title}</div>
                {article.summary && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{article.summary}</p>}
                <div className="text-gray-500 text-xs mt-2">{article.source} · {article.publishedAt?.toLocaleDateString() ?? "unknown date"}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Link href={`/admin/companies/${company.id}/edit`} className="bg-white/10 hover:bg-white/15 text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors">
          Edit Company
        </Link>
      </div>
    </div>
  )
}
