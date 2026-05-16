import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { claude } from "@/lib/claude"

export async function POST(req: NextRequest) {
  // Get uncategorized companies (no categoryId)
  const uncategorized = await prisma.company.findMany({
    where: { categoryId: null },
    take: 30,
  })

  if (uncategorized.length === 0) {
    return NextResponse.json({ message: "All companies already categorized", updated: 0 })
  }

  const categories = await prisma.category.findMany()

  if (categories.length === 0) {
    return NextResponse.json({ error: "No categories exist. Add categories first." }, { status: 400 })
  }

  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join("\n")
  const companyList = uncategorized.map((c, i) =>
    `${i + 1}. ${c.nameEn}${c.nameZhSimplified ? ` (${c.nameZhSimplified})` : ""}${c.description ? ` — ${c.description.slice(0, 150)}` : ""}`
  ).join("\n")

  let assignments: { index: number; categoryId: number }[] = []

  try {
    const response = await claude.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are categorizing Chinese semiconductor companies for an industry intelligence database.

Available categories (id: name):
${categoryList}

Companies to categorize:
${companyList}

For each company, assign the most appropriate category ID from the list above. If none fits, omit that company.

Return ONLY a JSON array: [{"index": N, "categoryId": ID}, ...]`,
      }],
    })

    const text = response.content.find(b => b.type === "text")
    if (text) {
      const jsonMatch = (text as any).text.match(/\[[\s\S]*\]/)
      if (jsonMatch) assignments = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    return NextResponse.json({ error: "Claude API error", detail: String(e) }, { status: 500 })
  }

  let updated = 0
  for (const { index, categoryId } of assignments) {
    const company = uncategorized[index - 1]
    const category = categories.find(c => c.id === categoryId)
    if (!company || !category) continue

    await prisma.company.update({
      where: { id: company.id },
      data: { categoryId: category.id },
    })
    updated++
  }

  return NextResponse.json({ updated, total: uncategorized.length })
}
