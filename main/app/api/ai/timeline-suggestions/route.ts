import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

type TimelineMilestone = {
  title?: string
  status?: string
  dueDate?: string
}

function generateFallbackAdvice(milestones: TimelineMilestone[]) {
  const now = Date.now()
  const completed = milestones.filter((m) => m.status === "completed").length
  const delayed = milestones.filter((m) => m.status === "delayed").length
  const overdue = milestones.filter((m) => {
    if (m.status === "completed") return false
    if (!m.dueDate) return false
    const due = new Date(m.dueDate).getTime()
    return Number.isFinite(due) && due < now
  }).length
  const next = milestones
    .filter((m) => m.status !== "completed" && Boolean(m.dueDate))
    .sort((a, b) => {
      const aTs = new Date(a.dueDate || "").getTime()
      const bTs = new Date(b.dueDate || "").getTime()
      return aTs - bTs
    })[0]

  const progress =
    milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0

  const lines: string[] = []
  lines.push(`Progress is ${progress}% (${completed}/${milestones.length} milestones complete).`)

  if (delayed > 0 || overdue > 0) {
    lines.push(
      `${delayed} delayed and ${overdue} overdue milestone(s): focus on recovery this week.`
    )
  } else {
    lines.push("No delayed or overdue milestones right now; keep your current pace.")
  }

  if (next?.title && next?.dueDate) {
    const dueText = new Date(next.dueDate).toLocaleDateString()
    lines.push(`Next priority: "${next.title}" due ${dueText}. Break it into 2-3 concrete tasks today.`)
  } else {
    lines.push("Set a clear next milestone with a due date to maintain momentum.")
  }

  lines.push("Share one short weekly update with your supervisor and adjust dates early if risks appear.")
  return lines.join(" ")
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { milestones } = body

    if (!milestones || !Array.isArray(milestones)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }

    const prompt = `
You are an academic project planning assistant.

A student has the following milestones:

${milestones
  .map(
    (m: any) =>
      `- ${m.title} | Status: ${m.status} | Due: ${m.dueDate}`
  )
  .join("\n")}

Give short, practical advice:
- identify risks
- suggest what to do next
- keep it under 120 words
`.trim()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        suggestion: generateFallbackAdvice(milestones),
        source: "fallback",
      })
    }

    try {
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      })

      const text = response.text
      if (text && text.trim()) {
        return NextResponse.json({
          suggestion: text.trim(),
          source: "gemini",
        })
      }
    } catch (aiErr) {
      console.error("timeline-suggestions ai error:", aiErr)
    }

    return NextResponse.json({
      suggestion: generateFallbackAdvice(milestones),
      source: "fallback",
    })
  } catch (err) {
    console.error("timeline-suggestions error:", err)
    return NextResponse.json(
      {
        error: "AI failed",
      },
      { status: 500 }
    )
  }
}
