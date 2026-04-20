import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { milestones } = body

    if (!milestones || !Array.isArray(milestones)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing" },
        { status: 500 }
      )
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    })

    const text = response.text

    return NextResponse.json({
      suggestion: text || "",
    })
  } catch (err) {
    console.error("timeline-suggestions error:", err)
    return NextResponse.json({ error: "AI failed" }, { status: 500 })
  }
}