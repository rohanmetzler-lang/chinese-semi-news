import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { claude } from "@/lib/claude"

const RSS_SOURCES = [
  { name: "Reuters Technology", url: "https://feeds.reuters.com/reuters/technologyNews", language: "en" },
  { name: "SCMP Tech", url: "https://www.scmp.com/rss/5/feed", language: "en" },
  { name: "TechNode", url: "https://technode.com/feed/", language: "en" },
  { name: "EE Times Asia", url: "https://www.eetasia.com/feed/", language: "en" },
  { name: "Semiconductor Today", url: "https://www.semiconductor-today.com/rss.xml", language: "en" },
]

const SEMI_KEYWORDS = [
  "semiconductor", "chip", "wafer", "foundry", "fab", "SMIC", "CXMT", "YMTC",
  "Huawei", "HiSilicon", "TSMC China", "chipmaker", "integrated circuit",
  "中芯", "芯片", "半导体", "晶圆", "华为", "集成电路",
]

async function fetchRSS(url: string): Promise<{ title: string; link: string; pubDate: string; description: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiIntelBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()

    const items: any[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1]

      const getText = (tag: string) => {
        const cdataM = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
        if (cdataM) return cdataM[1].trim()
        const plainM = item.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))
        return plainM ? plainM[1].trim() : ""
      }

      const linkM = item.match(/<link>([^<]+)<\/link>/i)
        || item.match(/<link\s[^>]*href="([^"]+)"/i)
        || item.match(/<guid[^>]*>([^<]+)<\/guid>/i)
      const link = linkM ? linkM[1].trim() : ""

      items.push({
        title: getText("title"),
        link,
        pubDate: getText("pubDate"),
        description: getText("description"),
      })
    }
    return items
  } catch {
    return []
  }
}

function isRelevant(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase()
  return SEMI_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))
}

async function summarizeArticles(articles: { title: string; description: string; url: string }[]): Promise<Map<string, string>> {
  if (articles.length === 0) return new Map()

  const numbered = articles.map((a, i) =>
    `${i + 1}. Title: ${a.title}\nSnippet: ${a.description?.replace(/<[^>]+>/g, "").slice(0, 300) || "(none)"}`
  ).join("\n\n")

  try {
    const response = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are summarizing news articles about China's semiconductor industry for an intelligence dashboard.

For each article below, write a 1-2 sentence factual summary suitable for analysts. Focus on: what happened, which companies/technologies are involved, and why it matters for the Chinese semiconductor ecosystem.

Return ONLY a JSON array with objects: {"index": N, "summary": "..."}

Articles:
${numbered}`,
      }],
    })

    const text = response.content.find(b => b.type === "text")
    if (!text) return new Map()

    const jsonMatch = (text as any).text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return new Map()

    const parsed: { index: number; summary: string }[] = JSON.parse(jsonMatch[0])
    const map = new Map<string, string>()
    for (const item of parsed) {
      const article = articles[item.index - 1]
      if (article) map.set(article.url, item.summary)
    }
    return map
  } catch {
    return new Map()
  }
}

export async function POST(req: NextRequest) {
  const results = { added: 0, skipped: 0, summarized: 0, sources: [] as string[] }

  const newArticles: { title: string; description: string; url: string; source: string; language: string; pubDate: string }[] = []

  for (const source of RSS_SOURCES) {
    const items = await fetchRSS(source.url)
    results.sources.push(`${source.name}: ${items.length} items fetched`)

    for (const item of items) {
      if (!item.title || !item.link) continue
      if (!isRelevant(item.title, item.description)) continue
      newArticles.push({ ...item, url: item.link, source: source.name, language: source.language })
    }
  }

  // Batch summarize new relevant articles with Claude (up to 20 at a time)
  const summaryMap = await summarizeArticles(newArticles.slice(0, 20))
  if (summaryMap.size > 0) results.summarized = summaryMap.size

  for (const article of newArticles) {
    const rawSummary = article.description?.replace(/<[^>]+>/g, "").slice(0, 500) || null
    const claudeSummary = summaryMap.get(article.url) ?? null

    try {
      await prisma.newsArticle.create({
        data: {
          title: article.title,
          summary: claudeSummary ?? rawSummary,
          url: article.url,
          source: article.source,
          language: article.language,
          publishedAt: article.pubDate ? new Date(article.pubDate) : null,
        },
      })
      results.added++
    } catch {
      results.skipped++
    }
  }

  return NextResponse.json(results)
}
