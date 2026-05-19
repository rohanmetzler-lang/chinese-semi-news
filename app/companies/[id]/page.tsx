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
        <Link href="/companies" className="text-slate-400 hover:text-slate-700 text-sm transition-colors">← Back to companies</Link>
      </div>

      <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-8 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{company.nameEn}</h1>
            {company.nameZhSimplified && (
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span className="text-xl text-slate-600">{company.nameZhSimplified}</span>
                {company.nameZhTraditional && company.nameZhTraditional !== company.nameZhSimplified && (
                  <span className="text-slate-400 text-sm">({company.nameZhTraditional})</span>
                )}
                {company.namePinyin && (
                  <span className="text-slate-400 text-sm italic">{company.namePinyin}</span>
                )}
              </div>
            )}
            {aliases.length > 0 && (
              <div className="mt-1 text-slate-400 text-xs">Also known as: {aliases.join(", ")}</div>
            )}
          </div>
          {company.isTop100 && (
            <span className="bg-sky-50 border border-sky-200 text-sky-500 text-sm font-bold px-3 py-1 rounded-full shrink-0">
              Top 100 #{company.top100Rank}
            </span>
          )}
        </div>

        {company.description && (
          <p className="text-slate-600 leading-relaxed mb-6">{company.description}</p>
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
              <span className="text-slate-400">Category</span>
              <span className="ml-3 text-slate-900">{company.category.name}</span>
            </div>
          )}
          {company.city && (
            <div>
              <span className="text-slate-400">Location</span>
              <span className="ml-3 text-slate-900">{company.city}{company.province ? `, ${company.province}` : ""}</span>
            </div>
          )}
          {company.foundedYear && (
            <div>
              <span className="text-slate-400">Founded</span>
              <span className="ml-3 text-slate-900">{company.foundedYear}</span>
            </div>
          )}
          {company.employeeCount && (
            <div>
              <span className="text-slate-400">Employees</span>
              <span className="ml-3 text-slate-900">{company.employeeCount.toLocaleString()}</span>
            </div>
          )}
          {websiteUrl && (
            <div>
              <span className="text-slate-400">Website</span>
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-3 text-sky-500 hover:underline">
                {websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </div>
          )}
          {company.address && (
            <div className="col-span-2">
              <span className="text-slate-400">Address</span>
              <span className="ml-3 text-slate-900">{company.address}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="bg-slate-100 border border-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Related News</h2>
        {company.newsArticles.length === 0 ? (
          <p className="text-slate-400 text-sm">No news articles linked to this company yet.</p>
        ) : (
          <div className="space-y-3">
            {company.newsArticles.map(({ article }) => (
              <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer"
                className="block bg-white border border-slate-100 shadow-sm rounded-xl p-4 hover:border-sky-200 hover:shadow-md transition-all">
                <div className="text-slate-900 text-sm font-medium">{article.title}</div>
                {article.summary && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{article.summary}</p>}
                <div className="text-slate-400 text-xs mt-2">{article.source} · {article.publishedAt?.toLocaleDateString() ?? "unknown date"}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Link href={`/admin/companies/${company.id}/edit`} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded-lg transition-colors">
          Edit Company
        </Link>
      </div>
    </div>
  )
}
