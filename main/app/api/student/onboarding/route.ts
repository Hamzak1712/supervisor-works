import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import {
  autoArchiveCompletedAcademicPeriods,
  getActiveAcademicPeriod,
} from "@/lib/academic-periods"

const db = prisma as any

type GuidedQuestionId =
  | "topicAreas"
  | "projectKind"
  | "knownTechnologies"
  | "learningTechnologies"
  | "practicalVsResearch"
  | "existingIdea"

type GuidedQuestion = {
  id: GuidedQuestionId
  question: string
  placeholder: string
}

type GuidedResponse = {
  id: GuidedQuestionId
  question: string
  answer: string
}

type OnboardingSignalSet = {
  preferredDomains: string[]
  desiredProjectType: "practical" | "research" | "hybrid" | "unspecified"
  existingSkills: string[]
  learningGoals: string[]
  interestKeywords: string[]
  hasInitialIdea: boolean
  summary: string
}

const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: "topicAreas",
    question: "What topic areas interest you most?",
    placeholder: "Example: AI, cybersecurity, software engineering, data science",
  },
  {
    id: "projectKind",
    question: "What kind of project do you want to do?",
    placeholder: "Example: build a recommendation system, create a research prototype, develop a mobile app",
  },
  {
    id: "knownTechnologies",
    question: "What technologies do you already know?",
    placeholder: "Example: React, Node.js, Python, SQL",
  },
  {
    id: "learningTechnologies",
    question: "What technologies do you want to learn?",
    placeholder: "Example: Docker, TensorFlow, cloud deployment",
  },
  {
    id: "practicalVsResearch",
    question: "Do you prefer a practical build project or a research-based project?",
    placeholder: "Example: Mostly practical, but with a short evaluation section",
  },
  {
    id: "existingIdea",
    question: "Do you already have a project idea in mind?",
    placeholder: "Describe your current idea, even if rough",
  },
]

const DOMAIN_PATTERNS: Array<{ domain: string; aliases: string[] }> = [
  { domain: "Artificial Intelligence", aliases: ["ai", "machine learning", "ml", "deep learning", "nlp", "computer vision", "data mining"] },
  { domain: "Cybersecurity", aliases: ["cyber", "security", "forensics", "penetration", "malware", "network security", "cryptography"] },
  { domain: "Web Development", aliases: ["web", "frontend", "backend", "full stack", "fullstack", "react", "next", "node"] },
  { domain: "Mobile Development", aliases: ["mobile", "android", "ios", "flutter", "react native"] },
  { domain: "Data Science", aliases: ["data science", "analytics", "statistics", "data analysis", "visualisation", "visualization"] },
  { domain: "Cloud Computing", aliases: ["cloud", "aws", "azure", "gcp", "devops", "kubernetes", "docker"] },
  { domain: "Internet of Things", aliases: ["iot", "embedded", "sensor", "raspberry pi", "arduino"] },
  { domain: "Human Computer Interaction", aliases: ["hci", "ux", "user experience", "usability", "accessibility", "interface"] },
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
  "want",
  "project",
  "projects",
  "build",
  "based",
  "using",
])

const QUESTION_BY_ID = new Map(
  GUIDED_QUESTIONS.map((question) => [question.id, question])
)

function deriveTitle(projectIdea: string) {
  const cleaned = projectIdea.trim()
  if (!cleaned) return "My Project Idea"
  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned
  return firstSentence.length > 80
    ? `${firstSentence.slice(0, 77)}...`
    : firstSentence
}

function normalizeCsvLike(value: string | string[]) {
  const raw = Array.isArray(value) ? value.join(",") : value

  return raw
    .split(/[\n,;/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ")
}

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

function uniqueList(values: string[]) {
  const set = new Set<string>()

  values.forEach((value) => {
    const cleaned = value.trim()
    if (!cleaned) return

    const canonical = cleaned.toLowerCase()
    if (!set.has(canonical)) {
      set.add(canonical)
    }
  })

  return Array.from(set).map((item) => {
    if (item.length === 0) return item
    return item
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ")
  })
}

function parseListAnswer(value: string) {
  return value
    .split(/[\n,;/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractTopKeywords(text: string, maxTerms: number) {
  const counts = new Map<string, number>()

  tokenize(text).forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .slice(0, maxTerms)
    .map(([term]) => term)
}

function detectPreferredDomains(text: string) {
  const normalized = normalizePhrase(text)
  const matched = DOMAIN_PATTERNS.filter((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias.toLowerCase()))
  ).map((entry) => entry.domain)

  return uniqueList(matched)
}

function deriveProjectType(value: string) {
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

  const cleaned: GuidedResponse[] = []

  input.forEach((item) => {
    if (!item || typeof item !== "object") return

    const maybeId = (item as { id?: unknown }).id
    const maybeAnswer = (item as { answer?: unknown }).answer

    if (typeof maybeId !== "string" || typeof maybeAnswer !== "string") {
      return
    }

    if (!QUESTION_BY_ID.has(maybeId as GuidedQuestionId)) {
      return
    }

    const question = QUESTION_BY_ID.get(maybeId as GuidedQuestionId)
    if (!question) return

    cleaned.push({
      id: maybeId as GuidedQuestionId,
      question: question.question,
      answer: maybeAnswer.trim(),
    })
  })

  const dedupedMap = new Map<GuidedQuestionId, GuidedResponse>()
  cleaned.forEach((entry) => {
    dedupedMap.set(entry.id, entry)
  })

  return GUIDED_QUESTIONS.map((question) => {
    const response = dedupedMap.get(question.id)

    return {
      id: question.id,
      question: question.question,
      answer: response?.answer ?? "",
    }
  })
}

function mapLegacyPayloadToResponses(body: Record<string, unknown>) {
  const projectIdea =
    typeof body.projectIdea === "string" ? body.projectIdea.trim() : ""
  const strengths =
    typeof body.strengths === "string" ? body.strengths.trim() : ""
  const weaknesses =
    typeof body.weaknesses === "string" ? body.weaknesses.trim() : ""

  if (!projectIdea && !strengths && !weaknesses) {
    return []
  }

  const map: Partial<Record<GuidedQuestionId, string>> = {
    topicAreas: projectIdea,
    projectKind: projectIdea,
    knownTechnologies: strengths,
    learningTechnologies: weaknesses,
    practicalVsResearch: "",
    existingIdea: projectIdea,
  }

  return GUIDED_QUESTIONS.map((question) => ({
    id: question.id,
    question: question.question,
    answer: map[question.id] ?? "",
  }))
}

function responsesToAnswerMap(responses: GuidedResponse[]) {
  return responses.reduce<Record<GuidedQuestionId, string>>((acc, item) => {
    acc[item.id] = item.answer.trim()
    return acc
  }, {
    topicAreas: "",
    projectKind: "",
    knownTechnologies: "",
    learningTechnologies: "",
    practicalVsResearch: "",
    existingIdea: "",
  })
}

function deriveSignals(answers: Record<GuidedQuestionId, string>): OnboardingSignalSet {
  const existingSkills = uniqueList(parseListAnswer(answers.knownTechnologies))
  const learningGoals = uniqueList(parseListAnswer(answers.learningTechnologies))

  const combinedInterestText = [
    answers.topicAreas,
    answers.projectKind,
    answers.existingIdea,
    answers.practicalVsResearch,
  ]
    .filter(Boolean)
    .join(" ")

  const preferredDomains = detectPreferredDomains(combinedInterestText)
  const desiredProjectType = deriveProjectType(
    `${answers.projectKind} ${answers.practicalVsResearch}`
  ) as OnboardingSignalSet["desiredProjectType"]

  const hasInitialIdea =
    Boolean(answers.existingIdea.trim()) &&
    !/\b(no|none|not yet|unsure|not sure)\b/i.test(answers.existingIdea)

  const interestKeywords = uniqueList(
    extractTopKeywords(
      [
        answers.topicAreas,
        answers.projectKind,
        answers.existingIdea,
        answers.knownTechnologies,
        answers.learningTechnologies,
      ]
        .filter(Boolean)
        .join(" "),
      12
    )
  )

  const summaryParts = [
    preferredDomains.length > 0
      ? `Preferred domains: ${preferredDomains.join(", ")}`
      : "Preferred domains: Not specified",
    `Project style: ${desiredProjectType}`,
    existingSkills.length > 0
      ? `Existing skills: ${existingSkills.join(", ")}`
      : "Existing skills: Not specified",
    learningGoals.length > 0
      ? `Learning goals: ${learningGoals.join(", ")}`
      : "Learning goals: Not specified",
    hasInitialIdea ? `Initial idea: ${answers.existingIdea}` : "Initial idea: None provided",
  ]

  return {
    preferredDomains,
    desiredProjectType,
    existingSkills,
    learningGoals,
    interestKeywords,
    hasInitialIdea,
    summary: summaryParts.join(". "),
  }
}

function safeSignals(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as OnboardingSignalSet
}

function buildProjectDescription(answers: Record<GuidedQuestionId, string>, signals: OnboardingSignalSet) {
  const narrative = [
    answers.existingIdea || answers.projectKind || answers.topicAreas,
    answers.practicalVsResearch
      ? `Preferred style: ${answers.practicalVsResearch}`
      : "",
    signals.summary,
  ]
    .filter(Boolean)
    .join("\n\n")

  return narrative.trim()
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

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [profile, project] = await Promise.all([
      db.studentProfile.findUnique({
        where: { userId: payload.sub },
        select: {
          onboardingCompleted: true,
          skills: true,
          interests: true,
          onboardingProjectIdea: true,
          onboardingStrengths: true,
          onboardingWeaknesses: true,
          onboardingConversation: true,
          onboardingSignals: true,
        },
      }),
      prisma.project.findUnique({
        where: { studentId: payload.sub },
        select: {
          description: true,
        },
      }),
    ])

    const storedResponses = normalizeResponses(profile?.onboardingConversation)
    const hasStoredConversation = storedResponses.some((entry) => Boolean(entry.answer))

    const legacyResponses = GUIDED_QUESTIONS.map((question) => {
      if (question.id === "existingIdea") {
        return {
          id: question.id,
          question: question.question,
          answer:
            profile?.onboardingProjectIdea || project?.description || "",
        }
      }

      if (question.id === "knownTechnologies") {
        return {
          id: question.id,
          question: question.question,
          answer:
            profile?.onboardingStrengths || profile?.skills || "",
        }
      }

      if (question.id === "learningTechnologies") {
        return {
          id: question.id,
          question: question.question,
          answer:
            profile?.onboardingWeaknesses || profile?.interests || "",
        }
      }

      if (question.id === "topicAreas") {
        return {
          id: question.id,
          question: question.question,
          answer: profile?.interests || "",
        }
      }

      if (question.id === "projectKind") {
        return {
          id: question.id,
          question: question.question,
          answer: profile?.onboardingProjectIdea || "",
        }
      }

      return {
        id: question.id,
        question: question.question,
        answer: "",
      }
    })

    const responses = hasStoredConversation ? storedResponses : legacyResponses
    const answers = responsesToAnswerMap(responses)

    return NextResponse.json(
      {
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        questions: GUIDED_QUESTIONS,
        responses,
        signals: safeSignals(profile?.onboardingSignals),
        answers: {
          projectIdea: answers.existingIdea || answers.projectKind,
          strengths: answers.knownTechnologies,
          weaknesses: answers.learningTechnologies,
        },
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

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const objectBody = body as Record<string, unknown>

    const responses = (() => {
      const guided = normalizeResponses(objectBody.responses)
      const hasGuidedAnswers = guided.some((entry) => Boolean(entry.answer))
      if (hasGuidedAnswers) return guided
      return mapLegacyPayloadToResponses(objectBody)
    })()

    if (responses.length === 0) {
      return NextResponse.json(
        { error: "Onboarding responses are required" },
        { status: 400 }
      )
    }

    const answers = responsesToAnswerMap(responses)

    const missing = GUIDED_QUESTIONS.find((question) => !answers[question.id]?.trim())
    if (missing) {
      return NextResponse.json(
        { error: `Please answer: ${missing.question}` },
        { status: 400 }
      )
    }

    const signals = deriveSignals(answers)

    const projectIdea =
      answers.existingIdea ||
      answers.projectKind ||
      answers.topicAreas ||
      "My Project Idea"

    const strengthsCsv = normalizeCsvLike(signals.existingSkills)
    const learningGoalsCsv = normalizeCsvLike(signals.learningGoals)

    await autoArchiveCompletedAcademicPeriods(prisma)

    const [profile, existingProject] = await Promise.all([
      db.studentProfile.upsert({
        where: { userId: payload.sub },
        create: {
          userId: payload.sub,
          skills: strengthsCsv || normalizeCsvLike(answers.knownTechnologies),
          interests:
            normalizeCsvLike([
              ...signals.preferredDomains,
              ...signals.learningGoals,
            ]) || normalizeCsvLike(answers.topicAreas),
          onboardingCompleted: true,
          onboardingProjectIdea: projectIdea,
          onboardingStrengths: strengthsCsv || normalizeCsvLike(answers.knownTechnologies),
          onboardingWeaknesses:
            learningGoalsCsv || normalizeCsvLike(answers.learningTechnologies),
          onboardingConversation: responses,
          onboardingSignals: signals,
        },
        update: {
          skills: strengthsCsv || normalizeCsvLike(answers.knownTechnologies),
          interests:
            normalizeCsvLike([
              ...signals.preferredDomains,
              ...signals.learningGoals,
            ]) || normalizeCsvLike(answers.topicAreas),
          onboardingCompleted: true,
          onboardingProjectIdea: projectIdea,
          onboardingStrengths: strengthsCsv || normalizeCsvLike(answers.knownTechnologies),
          onboardingWeaknesses:
            learningGoalsCsv || normalizeCsvLike(answers.learningTechnologies),
          onboardingConversation: responses,
          onboardingSignals: signals,
        },
        select: {
          id: true,
          userId: true,
          onboardingCompleted: true,
          onboardingProjectIdea: true,
          onboardingStrengths: true,
          onboardingWeaknesses: true,
          onboardingConversation: true,
          onboardingSignals: true,
        },
      }),
      prisma.project.findUnique({
        where: { studentId: payload.sub },
        select: {
          id: true,
          academicPeriodId: true,
          title: true,
          description: true,
          keywords: true,
          status: true,
        },
      }),
    ])

    const generatedDescription = buildProjectDescription(answers, signals)
    const generatedKeywords = normalizeCsvLike([
      ...signals.preferredDomains,
      ...signals.interestKeywords,
      ...signals.existingSkills,
      ...signals.learningGoals,
    ])

    let project = existingProject
    if (existingProject) {
      project = await prisma.project.update({
        where: { id: existingProject.id },
        data: {
          title:
            existingProject.title && existingProject.title.trim()
              ? existingProject.title
              : deriveTitle(projectIdea),
          description:
            existingProject.description && existingProject.description.trim()
              ? existingProject.description
              : generatedDescription,
          keywords:
            existingProject.keywords && existingProject.keywords.trim()
              ? existingProject.keywords
              : generatedKeywords,
          status: existingProject.status || "draft",
        },
      })
    } else {
      const activePeriod = await getActiveAcademicPeriod(prisma)
      if (activePeriod?.id) {
        project = await prisma.project.create({
          data: {
            studentId: payload.sub,
            academicPeriodId: activePeriod.id,
            title: deriveTitle(projectIdea),
            description: generatedDescription,
            keywords: generatedKeywords,
            status: "draft",
          },
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        onboardingCompleted: profile.onboardingCompleted,
        profile,
        project,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
