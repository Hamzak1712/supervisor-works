import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"

const db = prisma as any

type QuestionId =
  | "supervisionDomains"
  | "preferredProjectType"
  | "coreTechnologies"
  | "studentSupportStrengths"
  | "supervisionStyle"
  | "pastProjectThemes"

type GuidedQuestion = {
  id: QuestionId
  question: string
  placeholder: string
}

type GuidedResponse = {
  id: QuestionId
  question: string
  answer: string
}

type SupervisorSignalSet = {
  expertiseDomains: string[]
  preferredProjectType: "practical" | "research" | "hybrid" | "unspecified"
  coreTechnologies: string[]
  studentSupportStrengths: string[]
  supervisionStyle: string
  pastProjectThemes: string[]
  profileKeywords: string[]
  summary: string
}

const QUESTIONS: GuidedQuestion[] = [
  {
    id: "supervisionDomains",
    question: "Which topic areas can you supervise confidently?",
    placeholder: "Example: AI, data science, cybersecurity, software engineering",
  },
  {
    id: "preferredProjectType",
    question: "What project style do you supervise best?",
    placeholder: "Example: practical build, research-heavy, or hybrid",
  },
  {
    id: "coreTechnologies",
    question: "Which technologies and methods are your strongest?",
    placeholder: "Example: Python, React, cloud architecture, NLP evaluation",
  },
  {
    id: "studentSupportStrengths",
    question: "What student goals do you best support?",
    placeholder: "Example: production-ready apps, research writing, model evaluation",
  },
  {
    id: "supervisionStyle",
    question: "How would you describe your supervision style and expectations?",
    placeholder: "Example: structured weekly checkpoints with fast written feedback",
  },
  {
    id: "pastProjectThemes",
    question: "What project themes have you supervised before?",
    placeholder: "Example: recommendation systems, secure APIs, educational mobile apps",
  },
]

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
  "supervision",
  "student",
  "students",
  "projects",
  "project",
])

const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))

function normalizePhrase(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string) {
  return normalizePhrase(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

function extractKeywords(text: string, limit: number) {
  const counts = new Map<string, number>()

  tokenize(text).forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .slice(0, limit)
    .map(([token]) => token)
}

function parseList(value: string) {
  return value
    .split(/[\n,;/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueList(values: string[]) {
  const seen = new Set<string>()

  values.forEach((value) => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return
    seen.add(normalized)
  })

  return Array.from(seen).map((item) =>
    item
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ")
  )
}

function normalizeCsvLike(value: string | string[]) {
  const raw = Array.isArray(value) ? value.join(",") : value
  return raw
    .split(/[\n,;/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ")
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function deriveProjectType(value: string): SupervisorSignalSet["preferredProjectType"] {
  const normalized = normalizePhrase(value)

  const hasPractical =
    normalized.includes("practical") ||
    normalized.includes("build") ||
    normalized.includes("implementation") ||
    normalized.includes("prototype")

  const hasResearch =
    normalized.includes("research") ||
    normalized.includes("theory") ||
    normalized.includes("literature") ||
    normalized.includes("analysis")

  if (hasPractical && hasResearch) return "hybrid"
  if (hasPractical) return "practical"
  if (hasResearch) return "research"
  return "unspecified"
}

function normalizeResponses(input: unknown): GuidedResponse[] {
  if (!Array.isArray(input)) return []

  const byId = new Map<QuestionId, GuidedResponse>()

  input.forEach((item) => {
    if (!item || typeof item !== "object") return
    const maybeId = (item as { id?: unknown }).id
    const maybeAnswer = (item as { answer?: unknown }).answer

    if (typeof maybeId !== "string" || typeof maybeAnswer !== "string") return
    if (!QUESTION_BY_ID.has(maybeId as QuestionId)) return

    const question = QUESTION_BY_ID.get(maybeId as QuestionId)
    if (!question) return

    byId.set(maybeId as QuestionId, {
      id: maybeId as QuestionId,
      question: question.question,
      answer: maybeAnswer.trim(),
    })
  })

  return QUESTIONS.map((question) => {
    const item = byId.get(question.id)
    return {
      id: question.id,
      question: question.question,
      answer: item?.answer || "",
    }
  })
}

function responsesToMap(responses: GuidedResponse[]) {
  return responses.reduce<Record<QuestionId, string>>((acc, item) => {
    acc[item.id] = item.answer.trim()
    return acc
  }, {
    supervisionDomains: "",
    preferredProjectType: "",
    coreTechnologies: "",
    studentSupportStrengths: "",
    supervisionStyle: "",
    pastProjectThemes: "",
  })
}

function deriveSignals(answers: Record<QuestionId, string>): SupervisorSignalSet {
  const expertiseDomains = uniqueList(parseList(answers.supervisionDomains))
  const coreTechnologies = uniqueList(parseList(answers.coreTechnologies))
  const studentSupportStrengths = uniqueList(parseList(answers.studentSupportStrengths))
  const pastProjectThemes = uniqueList(parseList(answers.pastProjectThemes))
  const preferredProjectType = deriveProjectType(answers.preferredProjectType)

  const profileKeywords = uniqueList(
    extractKeywords(
      [
        answers.supervisionDomains,
        answers.preferredProjectType,
        answers.coreTechnologies,
        answers.studentSupportStrengths,
        answers.supervisionStyle,
        answers.pastProjectThemes,
      ]
        .filter(Boolean)
        .join(" "),
      14
    )
  )

  const summary = [
    expertiseDomains.length > 0
      ? `Domains: ${expertiseDomains.join(", ")}`
      : "Domains: Not specified",
    `Preferred style: ${preferredProjectType}`,
    coreTechnologies.length > 0
      ? `Technologies: ${coreTechnologies.join(", ")}`
      : "Technologies: Not specified",
    studentSupportStrengths.length > 0
      ? `Support strengths: ${studentSupportStrengths.join(", ")}`
      : "Support strengths: Not specified",
    answers.supervisionStyle
      ? `Supervision style: ${answers.supervisionStyle}`
      : "Supervision style: Not specified",
  ].join(". ")

  return {
    expertiseDomains,
    preferredProjectType,
    coreTechnologies,
    studentSupportStrengths,
    supervisionStyle: answers.supervisionStyle,
    pastProjectThemes,
    profileKeywords,
    summary,
  }
}

function safeSignals(value: unknown): SupervisorSignalSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as SupervisorSignalSet
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
      path: new URL(req.url).pathname,
      method: req.method,
    })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const profile = await db.supervisorProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        onboardingCompleted: true,
        expertise: true,
        onboardingConversation: true,
        onboardingSignals: true,
      },
    })

    const savedResponses = normalizeResponses(profile?.onboardingConversation)
    const hasConversation = savedResponses.some((item) => Boolean(item.answer))

    const legacyResponses = QUESTIONS.map((question) => {
      if (
        question.id === "supervisionDomains" ||
        question.id === "coreTechnologies" ||
        question.id === "pastProjectThemes"
      ) {
        return {
          id: question.id,
          question: question.question,
          answer: profile?.expertise || "",
        }
      }

      return {
        id: question.id,
        question: question.question,
        answer: "",
      }
    })

    const responses = hasConversation ? savedResponses : legacyResponses

    return NextResponse.json(
      {
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        questions: QUESTIONS,
        responses,
        signals: safeSignals(profile?.onboardingSignals),
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
      path: new URL(req.url).pathname,
      method: req.method,
    })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const responses = normalizeResponses((body as { responses?: unknown }).responses)

    if (responses.length === 0) {
      return NextResponse.json(
        { error: "Onboarding responses are required" },
        { status: 400 }
      )
    }

    const answers = responsesToMap(responses)
    const missing = QUESTIONS.find((question) => !answers[question.id]?.trim())

    if (missing) {
      return NextResponse.json(
        { error: `Please answer: ${missing.question}` },
        { status: 400 }
      )
    }

    const signals = deriveSignals(answers)

    const existingProfile = await db.supervisorProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        expertise: true,
      },
    })

    const mergedExpertise = normalizeCsvLike(
      uniqueList([
        ...splitCsv(existingProfile?.expertise),
        ...signals.expertiseDomains,
        ...signals.coreTechnologies,
        ...signals.pastProjectThemes,
        ...signals.profileKeywords.slice(0, 6),
      ])
    )

    const profile = await db.supervisorProfile.upsert({
      where: { userId: payload.sub },
      create: {
        userId: payload.sub,
        expertise: mergedExpertise,
        onboardingCompleted: true,
        onboardingConversation: responses,
        onboardingSignals: signals,
      },
      update: {
        expertise: mergedExpertise,
        onboardingCompleted: true,
        onboardingConversation: responses,
        onboardingSignals: signals,
      },
      select: {
        id: true,
        userId: true,
        expertise: true,
        onboardingCompleted: true,
        onboardingConversation: true,
        onboardingSignals: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        onboardingCompleted: profile.onboardingCompleted,
        profile,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
