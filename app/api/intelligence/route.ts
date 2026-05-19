import { NextRequest, NextResponse } from 'next/server'
import { analyzeNews } from '@/lib/semi-intelligence'
import { fetchIndustryNews, fetchPolicyNews, fetchInvestmentNews } from '@/lib/semi-newsapi'

export async function POST(request: NextRequest) {
  try {
    const { timeframe, mode } = await request.json()
    const tf = timeframe ?? '1w'
    const resolvedMode: 'industry' | 'policy' | 'investment' =
      mode === 'policy' ? 'policy' : mode === 'investment' ? 'investment' : 'industry'

    const articles =
      resolvedMode === 'policy'
        ? await fetchPolicyNews(tf)
        : resolvedMode === 'investment'
        ? await fetchInvestmentNews(tf)
        : await fetchIndustryNews(tf)

    if (!articles.length) {
      return NextResponse.json({ error: 'No news found for this time frame.' }, { status: 400 })
    }

    const result = await analyzeNews(articles, tf, resolvedMode)
    return NextResponse.json({ ...result, articles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
