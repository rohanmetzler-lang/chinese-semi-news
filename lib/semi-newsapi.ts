import { XMLParser } from 'fast-xml-parser'

export interface RawArticle {
  title: string
  url: string
  source: { name: string }
  publishedAt: string
  description: string | null
}

interface RawArticleDraft {
  title: string
  url: string
  source: { name: string }
  publishedAt: string | null
  description: string | null
}

const TIMEFRAME_DAYS: Record<string, number> = {
  '1d': 1,
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '1y': 365,
}

// General semiconductor + China tech news feeds
const INDUSTRY_FEEDS: { name: string; url: string; filterKeywords?: boolean }[] = [
  { name: 'TechNode', url: 'https://technode.com/feed/' },
  { name: 'EE Times Asia', url: 'https://www.eetasia.com/feed/' },
  { name: 'Semiconductor Today', url: 'https://www.semiconductor-today.com/rss.xml' },
  { name: 'Reuters Technology', url: 'https://feeds.reuters.com/reuters/technologyNews', filterKeywords: true },
  { name: 'SCMP Tech', url: 'https://www.scmp.com/rss/5/feed', filterKeywords: true },
  { name: 'The Register', url: 'https://www.theregister.com/headlines.atom', filterKeywords: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', filterKeywords: true },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/rss', filterKeywords: true },
  { name: 'Tom\'s Hardware', url: 'https://www.tomshardware.com/feeds/all', filterKeywords: true },
  { name: 'AnandTech', url: 'https://www.anandtech.com/rss/', filterKeywords: true },
]

// Policy, trade, export control focused feeds
const POLICY_FEEDS: { name: string; url: string; filterKeywords?: boolean }[] = [
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews', filterKeywords: true },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', filterKeywords: true },
  { name: 'SCMP', url: 'https://www.scmp.com/rss/2/feed', filterKeywords: true },
  { name: 'TechNode', url: 'https://technode.com/feed/' },
  { name: 'Reuters Technology', url: 'https://feeds.reuters.com/reuters/technologyNews', filterKeywords: true },
  { name: 'Bloomberg Technology', url: 'https://feeds.bloomberg.com/technology/news.rss', filterKeywords: true },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', filterKeywords: true },
  { name: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml', filterKeywords: true },
]

// Investment and M&A focused feeds
const INVESTMENT_FEEDS: { name: string; url: string; filterKeywords?: boolean }[] = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', filterKeywords: true },
  { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', filterKeywords: true },
  { name: 'Reuters Technology', url: 'https://feeds.reuters.com/reuters/technologyNews', filterKeywords: true },
  { name: 'TechNode', url: 'https://technode.com/feed/' },
  { name: 'EE Times Asia', url: 'https://www.eetasia.com/feed/' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', filterKeywords: true },
]

const SEMI_KEYWORDS = [
  'semiconductor', 'chip', 'wafer', 'foundry', 'fab', 'lithography', 'node',
  'SMIC', 'CXMT', 'YMTC', 'HiSilicon', 'Huawei', 'Cambricon', 'Horizon Robotics',
  'Unisoc', 'Loongson', 'JCET', 'Hua Hong', 'GigaDevice',
  'TSMC', 'Samsung', 'Intel', 'NVIDIA', 'AMD', 'Qualcomm', 'ASML',
  'integrated circuit', 'chipmaker', 'processor', 'GPU', 'CPU', 'AI chip',
  'memory', 'DRAM', 'NAND', 'flash storage', 'advanced packaging',
  'EDA', 'design tool', 'photolithography', 'etching', 'deposition',
  'silicon', 'compound semiconductor', 'gallium nitride', 'silicon carbide',
]

const POLICY_KEYWORDS = [
  ...SEMI_KEYWORDS,
  'export control', 'export ban', 'entity list', 'sanctions', 'tariff', 'trade war',
  'technology transfer', 'national security', 'BIS', 'commerce department',
  'chips act', 'subsidy', 'decoupling', 'supply chain', 'geopolitic',
  'China tech', 'US-China', 'Taiwan strait', 'tech war', 'restriction',
  'license', 'dual-use', 'military', 'advanced technology',
]

const INVESTMENT_KEYWORDS = [
  ...SEMI_KEYWORDS,
  'fund', 'invest', 'acqui', 'raises', 'raised', 'round', 'series a', 'series b',
  'seed', 'venture', 'vc', 'private equity', 'valuation', 'ipo', 'merger',
  'deal', 'capital', 'backed', 'financing', 'stake', 'equity', 'buyout',
  'billion', 'million', 'funding', 'backed by',
]

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
}

interface RssItem {
  title?: string | { '#text'?: string }
  link?: string | { '#text'?: string; href?: string }
  pubDate?: string
  published?: string
  updated?: string
  description?: string
  summary?: string
  'content:encoded'?: string
  id?: string
}

async function fetchFeed(
  feed: { name: string; url: string; filterKeywords?: boolean },
  keywords: string[]
): Promise<RawArticle[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SemiIntelBot/1.0)' },
      next: { revalidate: 0 },
    })
    clearTimeout(timeout)
    if (!res.ok) return []

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    const parsed = parser.parse(xml)

    const channel = parsed?.rss?.channel ?? parsed?.feed
    if (!channel) return []

    const rawItems: RssItem[] = channel.item ?? channel.entry ?? []
    const items = Array.isArray(rawItems) ? rawItems : [rawItems]

    return items
      .map((item): RawArticleDraft => {
        const title =
          typeof item.title === 'string' ? item.title : item.title?.['#text'] ?? ''

        const url =
          typeof item.link === 'string'
            ? item.link
            : item.link?.href ?? item.link?.['#text'] ?? item.id ?? ''

        const pubDateRaw = item.pubDate ?? item.published ?? item.updated ?? ''
        const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null
        const publishedAt =
          parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null

        const rawDesc = item['content:encoded'] ?? item.description ?? item.summary ?? ''
        const description = rawDesc ? stripHtml(String(rawDesc)).slice(0, 300) : null

        return {
          title: stripHtml(String(title)),
          url: String(url),
          source: { name: feed.name },
          publishedAt,
          description,
        }
      })
      .filter((a): a is RawArticle => {
        if (!a.title || !a.url || !a.publishedAt) return false
        if (!feed.filterKeywords) return true
        return matchesKeywords(a.title + ' ' + (a.description ?? ''), keywords)
      })
  } catch {
    clearTimeout(timeout)
    return []
  }
}

function filterByTimeframe(articles: RawArticle[], timeframe: string): RawArticle[] {
  const days = TIMEFRAME_DAYS[timeframe] ?? 7
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return articles
    .filter((a) => new Date(a.publishedAt) >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 25)
}

export async function fetchIndustryNews(timeframe: string): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    INDUSTRY_FEEDS.map((f) => fetchFeed(f, SEMI_KEYWORDS))
  )
  return filterByTimeframe(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    timeframe
  )
}

export async function fetchPolicyNews(timeframe: string): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    POLICY_FEEDS.map((f) => fetchFeed(f, POLICY_KEYWORDS))
  )
  return filterByTimeframe(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    timeframe
  )
}

export async function fetchInvestmentNews(timeframe: string): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    INVESTMENT_FEEDS.map((f) => fetchFeed(f, INVESTMENT_KEYWORDS))
  )
  return filterByTimeframe(
    results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    timeframe
  )
}
