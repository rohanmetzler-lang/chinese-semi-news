import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { claude } from "@/lib/claude"
import { XMLParser } from "fast-xml-parser"

// ── Sources ────────────────────────────────────────────────────────────────

const SOURCES: { name: string; url: string; filter: boolean; language: string }[] = [
  // US semiconductor & tech — high signal, always filter
  { name: "EE Times",               url: "https://www.eetimes.com/feed/",                                    filter: false, language: "en" },
  { name: "EE Times Asia",          url: "https://www.eetasia.com/feed/",                                    filter: false, language: "en" },
  { name: "Semiconductor Engineering", url: "https://semiengineering.com/feed/",                            filter: false, language: "en" },
  { name: "Electronics Weekly",     url: "https://www.electronicsweekly.com/feed/",                          filter: false, language: "en" },
  { name: "Tom's Hardware",         url: "https://www.tomshardware.com/feeds/all",                           filter: true,  language: "en" },
  { name: "IEEE Spectrum",          url: "https://spectrum.ieee.org/feeds/feed.rss",                         filter: true,  language: "en" },
  { name: "The Register",           url: "https://www.theregister.com/headlines.atom",                       filter: true,  language: "en" },

  // Major US news — filter for semiconductor/chip/China tech content
  { name: "WSJ",                    url: "https://feeds.content.dowjones.io/public/rss/RSSWSJD",             filter: true,  language: "en" },
  { name: "CNBC Technology",        url: "https://www.cnbc.com/id/19854910/device/rss/rss.html",             filter: true,  language: "en" },
  { name: "Bloomberg Technology",   url: "https://feeds.bloomberg.com/technology/news.rss",                  filter: true,  language: "en" },
  { name: "Financial Times",        url: "https://www.ft.com/technology?format=rss",                         filter: true,  language: "en" },
  { name: "Ars Technica",           url: "https://feeds.arstechnica.com/arstechnica/technology-lab",         filter: true,  language: "en" },
  { name: "VentureBeat",            url: "https://venturebeat.com/feed/",                                    filter: true,  language: "en" },

  // Asia-focused English sources
  { name: "SCMP",                   url: "https://www.scmp.com/rss/91/feed",                                 filter: true,  language: "en" },
  { name: "TechNode",               url: "https://technode.com/feed/",                                       filter: true,  language: "en" },
  { name: "Nikkei Asia",            url: "https://asia.nikkei.com/rss/feed/nar",                             filter: true,  language: "en" },
  { name: "PandaDaily",             url: "https://pandaily.com/feed/",                                       filter: true,  language: "en" },
  { name: "ChinaTechNews",          url: "https://www.chinatechnews.com/feed",                               filter: true,  language: "en" },

  // Chinese-language
  { name: "36Kr",                   url: "https://36kr.com/feed",                                            filter: true,  language: "zh" },
]

// ── Keywords ───────────────────────────────────────────────────────────────

const KEYWORDS_EN = [
  // companies
  "SMIC", "CXMT", "YMTC", "HiSilicon", "Huawei", "Cambricon", "Horizon Robotics",
  "Unisoc", "Loongson", "JCET", "Hua Hong", "GigaDevice", "StarPower", "BYD Semiconductor",
  "TSMC", "Samsung", "Intel", "NVIDIA", "AMD", "Qualcomm", "ASML", "Applied Materials",
  "Lam Research", "KLA",
  // technology
  "semiconductor", "chip", "chipmaker", "wafer", "foundry", "fab", "lithography",
  "integrated circuit", "processor", "GPU", "CPU", "AI chip", "memory chip",
  "DRAM", "NAND", "flash", "advanced packaging", "EDA", "photolithography",
  "silicon", "gallium nitride", "silicon carbide", "compound semiconductor",
  // industry / policy
  "export control", "export ban", "entity list", "chip ban", "chip war",
  "China chip", "China semiconductor", "China tech", "US-China tech",
  "chips act", "semiconductor subsidy", "tech sanctions", "trade restriction",
  "supply chain", "fab capacity", "node", "2nm", "3nm", "5nm", "7nm",
]

const KEYWORDS_ZH = [
  "半导体", "芯片", "晶圆", "中芯", "华为", "海思", "集成电路",
  "存储", "光刻", "封装", "代工", "先进制程", "出口管制", "制裁",
]

function isRelevant(title: string, description: string, language: string): boolean {
  const text = `${title} ${description}`.toLowerCase()
  const keywords = language === "zh" ? KEYWORDS_ZH : KEYWORDS_EN
  return keywords.some(kw => text.includes(kw.toLowerCase()))
}

// ── RSS parser ─────────────────────────────────────────────────────────────

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" })

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim()
}

interface ArticleDraft {
  title: string
  url: string
  source: string
  language: string
  publishedAt: Date | null
  description: string | null
}

async function fetchFeed(source: typeof SOURCES[number]): Promise<ArticleDraft[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiIntelBot/1.0)" },
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const parsed = parser.parse(xml)

    const channel = parsed?.rss?.channel ?? parsed?.feed
    if (!channel) return []

    const rawItems = channel.item ?? channel.entry ?? []
    const items = Array.isArray(rawItems) ? rawItems : [rawItems]

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    return items.flatMap((item: any): ArticleDraft[] => {
      const title = stripHtml(
        typeof item.title === "string" ? item.title : item.title?.["#text"] ?? item.title?._ ?? ""
      )
      const url =
        typeof item.link === "string" ? item.link.trim()
        : item.link?.href ?? item.link?.["#text"] ?? item.id ?? ""
      const pubRaw = item.pubDate ?? item.published ?? item.updated ?? ""
      const pubDate = pubRaw ? new Date(pubRaw) : null
      const description = stripHtml(
        String(item["content:encoded"] ?? item.description ?? item.summary ?? item.content ?? "")
      ).slice(0, 400)

      if (!title || !url) return []
      // Drop articles older than 30 days
      if (pubDate && pubDate < thirtyDaysAgo) return []
      // Apply keyword filter if configured
      if (source.filter && !isRelevant(title, description, source.language)) return []

      return [{ title, url: url.trim(), source: source.name, language: source.language, publishedAt: pubDate, description: description || null }]
    })
  } catch {
    return []
  }
}

// ── Claude summarization ───────────────────────────────────────────────────

async function summarize(articles: ArticleDraft[]): Promise<Map<string, string>> {
  if (!articles.length) return new Map()

  const numbered = articles.map((a, i) =>
    `${i + 1}. ${a.title}\n   Source: ${a.source} | ${a.description ?? "(no description)"}`
  ).join("\n\n")

  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Summarize each article about semiconductors/chips/China tech in 1-2 factual sentences for analysts.
Focus on: what happened, which companies/technologies, why it matters.
Return ONLY a JSON array: [{"index": N, "summary": "..."}]

Articles:
${numbered}`,
      }],
    })
    const text = response.content.find(b => b.type === "text")
    if (!text) return new Map()
    const match = (text as any).text.match(/\[[\s\S]*\]/)
    if (!match) return new Map()
    const parsed: { index: number; summary: string }[] = JSON.parse(match[0])
    const map = new Map<string, string>()
    for (const item of parsed) {
      const a = articles[item.index - 1]
      if (a) map.set(a.url, item.summary)
    }
    return map
  } catch {
    return new Map()
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  const results = {
    added: 0,
    skipped: 0,
    tooOld: 0,
    summarized: 0,
    sources: [] as string[],
  }

  // Fetch all feeds in parallel
  const settled = await Promise.allSettled(SOURCES.map(fetchFeed))
  const allArticles: ArticleDraft[] = []

  SOURCES.forEach((source, i) => {
    const result = settled[i]
    const articles = result.status === "fulfilled" ? result.value : []
    allArticles.push(...articles)
    results.sources.push(`${source.name}: ${articles.length} relevant`)
  })

  // Deduplicate by URL (skip already-stored articles)
  const existingUrls = new Set(
    (await prisma.newsArticle.findMany({ select: { url: true } })).map(a => a.url)
  )
  const newArticles = allArticles.filter(a => !existingUrls.has(a.url))

  // Summarize up to 40 new articles with Claude Haiku (fast + cheap)
  const toSummarize = newArticles.slice(0, 40)
  const summaryMap = await summarize(toSummarize)
  results.summarized = summaryMap.size

  // Store all new articles
  for (const article of newArticles) {
    try {
      await prisma.newsArticle.create({
        data: {
          title: article.title,
          summary: summaryMap.get(article.url) ?? article.description,
          url: article.url,
          source: article.source,
          language: article.language,
          publishedAt: article.publishedAt,
        },
      })
      results.added++
    } catch {
      results.skipped++
    }
  }

  return NextResponse.json(results)
}
