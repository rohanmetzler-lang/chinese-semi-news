import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/companies" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Back to companies</Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{company.nameEn}</h1>
            {company.nameZhSimplified && (
              <div className="mt-1 flex items-center gap-3">
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
              <div className="mt-1 text-gray-600 text-xs">Also known as: {aliases.join(", ")}</div>
            )}
          </div>
          {company.isTop100 && (
            <span className="bg-red-900/50 border border-red-800 text-red-400 text-sm font-bold px-3 py-1 rounded-full">
              Top 100 #{company.top100Rank}
            </span>
          )}
        </div>

        {company.description && (
          <p className="text-gray-300 leading-relaxed mb-6">{company.description}</p>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {company.ticker && (
            <div>
              <span className="text-gray-500">Ticker</span>
              <span className="ml-3 font-mono text-green-400 bg-green-950 px-2 py-0.5 rounded">
                {company.exchange}:{company.ticker}
              </span>
            </div>
          )}
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
          {company.website && (
            <div>
              <span className="text-gray-500">Website</span>
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="ml-3 text-red-400 hover:underline">
                {company.website.replace(/^https?:\/\//, "")}
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
              <span key={tag} className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Related News */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Related News</h2>
        {company.newsArticles.length === 0 ? (
          <p className="text-gray-500 text-sm">No news articles linked to this company yet.</p>
        ) : (
          <div className="space-y-3">
            {company.newsArticles.map(({ article }) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="text-white text-sm font-medium">{article.title}</div>
                {article.summary && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{article.summary}</p>}
                <div className="text-gray-600 text-xs mt-2">{article.source} · {article.publishedAt?.toLocaleDateString() ?? "—"}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Link href={`/admin/companies/${company.id}/edit`} className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          Edit Company
        </Link>
      </div>
    </div>
  )
}
