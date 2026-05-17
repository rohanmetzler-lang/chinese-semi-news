import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchStockData } from "@/lib/stockFetch"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id: Number(id) },
    select: { ticker: true, exchange: true },
  })

  if (!company?.ticker || !company?.exchange) {
    return NextResponse.json({ error: "No ticker" }, { status: 404 })
  }

  const stock = await fetchStockData(company.ticker, company.exchange)
  if (!stock) return NextResponse.json({ error: "Could not fetch stock data" }, { status: 502 })

  // Update stored value in background
  prisma.company.update({
    where: { id: Number(id) },
    data: {
      stockPrice: stock.price,
      stockChange: stock.change,
      marketCap: stock.marketCap,
      stockCurrency: stock.currency,
      stockUpdatedAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json(stock)
}
