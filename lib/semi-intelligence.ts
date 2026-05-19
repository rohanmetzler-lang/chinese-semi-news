import Anthropic from '@anthropic-ai/sdk'
import type { RawArticle } from './semi-newsapi'

export interface CategorizedArticle extends RawArticle {
  category: 'need_to_know' | 'strategy_altering'
  insight: string
}

export interface Analysis {
  summary: string
  adjustments: string[]
}

export interface IntelligenceData {
  needToKnow: CategorizedArticle[]
  strategyAltering: CategorizedArticle[]
  analysis: Analysis
}

const TIMEFRAME_LABELS: Record<string, string> = {
  '1d': 'the past 24 hours',
  '1w': 'the past 7 days',
  '1m': 'the past 30 days',
  '3m': 'the past 3 months',
  '1y': 'the past year',
}

const CITATION_RULE = `When citing a source, write the publication name followed by the article index in brackets immediately before the closing punctuation, e.g. "SMIC expanded capacity (TechNode[2])." or "Two outlets covered the ban (Reuters[1] & EE Times Asia[4])." Use the exact source name and index from the articles list. Do NOT include any URLs. Never begin a sentence with "As X reports" or "According to X" -- citations go at the end only.`

const MODE_CONTEXT: Record<string, string> = {
  industry: `You are a semiconductor industry analyst covering China's chip ecosystem for an intelligence dashboard used by investors, policy analysts, and industry professionals.

Focus on: company announcements, technology breakthroughs, production milestones, fab capacity, new chip designs, partnerships, and supply chain developments involving Chinese semiconductor companies.

Categorization:
- "need_to_know": Major discrete events -- product launches, fab expansions, production milestones, company partnerships, leadership changes, breakthrough technologies
- "strategy_altering": Industry direction signals -- technology trends, competitive shifts, supply chain realignments, ecosystem changes that signal longer-term structural shifts`,

  policy: `You are a geopolitical technology analyst tracking US-China semiconductor policy, export controls, and trade dynamics.

Focus on: export control rules, entity list additions, sanctions, tariffs, chip act funding decisions, diplomatic developments affecting semiconductor supply chains, and regulatory changes in both the US and China.

Categorization:
- "need_to_know": Concrete policy actions -- new export restrictions, entity list additions, subsidy announcements, regulatory rulings, diplomatic incidents with immediate semiconductor implications
- "strategy_altering": Policy direction signals -- legislative trends, diplomatic shifts, multilateral coordination on tech policy, emerging regulatory frameworks`,

  investment: `You are an investment analyst tracking capital flows into China's semiconductor sector and related M&A activity.

Focus on: funding rounds, IPOs, M&A deals, government fund deployments, PE/VC activity, valuations, and strategic investments in Chinese semiconductor companies and their suppliers.

Categorization:
- "need_to_know": Completed deals -- funding rounds closed, acquisitions announced, IPO filings, major government fund deployments
- "strategy_altering": Investment trend signals -- sector valuation shifts, investor sentiment changes, emerging funding patterns, strategic capital allocation trends`,
}

const TIMEFRAME_INSTRUCTIONS: Record<string, (mode: string) => string> = {
  '1d': () => `For each article write one punchy insight sentence (under 20 words) on the key implication.

Then write:
1. A 2-3 sentence summary of the most significant development today and its immediate stakes. ${CITATION_RULE}
2. 2-3 specific items worth watching in the next 24-48 hours`,

  '1w': () => `For each article write one punchy insight sentence (under 20 words) on the key implication.

Then write:
1. A 3-4 sentence summary of the week's most important developments and any emerging patterns. ${CITATION_RULE}
2. 3-4 specific items to monitor over the coming weeks`,

  '1m': () => `For each article write one punchy insight sentence (under 20 words) on the key implication.

Then write:
1. A 4-5 sentence summary identifying 2-3 dominant themes this month and what they signal. ${CITATION_RULE}
2. 4-5 specific items to watch heading into next month`,

  '3m': () => `For each article write one punchy insight sentence (under 20 words) on the key implication.

Then write:
1. A 5-6 sentence thematic summary of the quarter. Identify 3-4 major narrative arcs with specific examples from the articles. Close with what the convergence means for the near-term outlook. ${CITATION_RULE}
2. 5 specific watchlist items for the next quarter`,

  '1y': () => `For each article write one punchy insight sentence (under 20 words) on the key implication.

Then write:
1. A 6-8 sentence year-in-review. Identify 3-5 defining themes that reshaped China's semiconductor landscape this year, with concrete examples from the articles for each. Close with a synthesizing sentence on what this year's arc means for the sector's trajectory. ${CITATION_RULE}
2. 5 long-term structural questions or high-priority items to track in the year ahead`,
}

const JSON_FORMAT = `RETURN ONLY valid JSON with this exact structure (no markdown, no preamble):
{
  "articles": [
    { "index": 0, "category": "need_to_know", "insight": "..." }
  ],
  "analysis": {
    "summary": "...",
    "adjustments": ["...", "..."]
  }
}`

export async function analyzeNews(
  articles: RawArticle[],
  timeframe: string,
  mode: 'industry' | 'policy' | 'investment'
): Promise<IntelligenceData> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const articlesText = articles
    .map(
      (a, i) =>
        `[${i}] ${a.title}\nSource: ${a.source?.name ?? 'Unknown'} | Date: ${a.publishedAt} | URL: ${a.url}\n${a.description ?? 'No description.'}`
    )
    .join('\n\n')

  const timeframeLabel = TIMEFRAME_LABELS[timeframe] ?? 'the past week'
  const modeContext = MODE_CONTEXT[mode]
  const taskInstructions = (TIMEFRAME_INSTRUCTIONS[timeframe] ?? TIMEFRAME_INSTRUCTIONS['1w'])(mode)

  const prompt = `${modeContext}

ANALYSIS TIME FRAME: ${timeframeLabel}

ARTICLES TO ANALYZE:
${articlesText}

TASK:
${taskInstructions}

Do not use em dashes. Do not include URLs anywhere in your output. Never say "article".

${JSON_FORMAT}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')

  let parsed: {
    articles: Array<{ index: number; category: 'need_to_know' | 'strategy_altering'; insight: string }>
    analysis: { summary: string; adjustments: string[] }
  }

  try {
    parsed = JSON.parse(content.text)
  } catch {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse Claude response as JSON')
    parsed = JSON.parse(jsonMatch[0])
  }

  const needToKnow: CategorizedArticle[] = []
  const strategyAltering: CategorizedArticle[] = []

  for (const item of parsed.articles) {
    const raw = articles[item.index]
    if (!raw) continue
    const categorized: CategorizedArticle = { ...raw, category: item.category, insight: item.insight }
    if (item.category === 'need_to_know') needToKnow.push(categorized)
    else strategyAltering.push(categorized)
  }

  return {
    needToKnow,
    strategyAltering,
    analysis: {
      summary: parsed.analysis.summary,
      adjustments: parsed.analysis.adjustments,
    },
  }
}
