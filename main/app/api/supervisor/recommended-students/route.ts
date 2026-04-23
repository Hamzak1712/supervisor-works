import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { getMatchingSettings } from "@/lib/matching-engine"

const db = prisma as any

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
  "using",
  "use",
  "based",
  "project",
  "system",
  "study",
  "analysis",
  "design",
  "implementation",
  "approach",
])

type StudentSignals = {
  preferredDomains: string[]
  desiredProjectType: string
  existingSkills: string[]
  learningGoals: string[]
  interestKeywords: string[]
  summary: string
}

type SupervisorSignals = {
  expertiseDomains: string[]
  preferredProjectType: string
  coreTechnologies: string[]
  studentSupportStrengths: string[]
  pastProjectThemes: string[]
  profileKeywords: string[]
  summary: string
}

type BaselineMatch = {
  student: {
    id: string
    fullName: string
    email: string
    projectTitle: string
    projectStatus: string | null
    requestStatus: string | null
  }
  matchScore: number
  matchReasons: string[]
  source: "rule_based"
  evidenceTerms: string[]
}

function splitCsv(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return normalizePhrase(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

function extractMeaningfulTerms(text: string, maxTerms: number): string[] {
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

function uniqueNormalizedPhrases(values: string[]): string[] {
  const set = new Set<string>()
  values.forEach((value) => {
    const normalized = normalizePhrase(value)
    if (normalized) {
      set.add(normalized)
    }
  })
  return Array.from(set)
}

function mergeUniqueTerms(...collections: string[][]): string[] {
  const set = new Set<string>()
  collections.forEach((collection) => {
    collection.forEach((item) => {
      const cleaned = item.trim()
      if (cleaned) set.add(cleaned)
    })
  })
  return Array.from(set)
}

function tokenJaccardSimilarity(aTokens: string[], bTokens: string[]): number {
  if (aTokens.length === 0 || bTokens.length === 0) return 0

  const aSet = new Set(aTokens)
  const bSet = new Set(bTokens)

  let intersection = 0
  aSet.forEach((token) => {
    if (bSet.has(token)) intersection += 1
  })

  const union = aSet.size + bSet.size - intersection
  if (union === 0) return 0
  return intersection / union
}

function phraseSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1

  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
    return 0.9
  }

  const aTokens = tokenize(a)
  const bTokens = tokenize(b)
  const jaccard = tokenJaccardSimilarity(aTokens, bTokens)
  if (jaccard >= 0.7) return 0.85
  if (jaccard >= 0.4) return 0.65
  if (jaccard >= 0.2) return 0.45
  return 0
}

function computeAlignment(sourceTerms: string[], targetTerms: string[]) {
  if (sourceTerms.length === 0 || targetTerms.length === 0) {
    return {
      score: 0,
      matchedTerms: [] as string[],
    }
  }

  const bestMatches = sourceTerms.map((source) => {
    const similarity = targetTerms.reduce((best, target) => {
      return Math.max(best, phraseSimilarity(source, target))
    }, 0)

    return {
      source,
      similarity,
    }
  })

  const similarityAverage =
    bestMatches.reduce((sum, item) => sum + item.similarity, 0) /
    sourceTerms.length

  const matched = bestMatches
    .filter((item) => item.similarity >= 0.45)
    .sort((a, b) => b.similarity - a.similarity)
    .map((item) => item.source)

  const coverage = matched.length / sourceTerms.length

  return {
    score: similarityAverage * 0.7 + coverage * 0.3,
    matchedTerms: matched.slice(0, 6),
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function parseStudentSignals(value: unknown): StudentSignals {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      preferredDomains: [],
      desiredProjectType: "unspecified",
      existingSkills: [],
      learningGoals: [],
      interestKeywords: [],
      summary: "",
    }
  }

  const raw = value as Record<string, unknown>

  return {
    preferredDomains: Array.isArray(raw.preferredDomains)
      ? raw.preferredDomains.filter((item): item is string => typeof item === "string")
      : [],
    desiredProjectType:
      typeof raw.desiredProjectType === "string"
        ? raw.desiredProjectType
        : "unspecified",
    existingSkills: Array.isArray(raw.existingSkills)
      ? raw.existingSkills.filter((item): item is string => typeof item === "string")
      : [],
    learningGoals: Array.isArray(raw.learningGoals)
      ? raw.learningGoals.filter((item): item is string => typeof item === "string")
      : [],
    interestKeywords: Array.isArray(raw.interestKeywords)
      ? raw.interestKeywords.filter((item): item is string => typeof item === "string")
      : [],
    summary: typeof raw.summary === "string" ? raw.summary : "",
  }
}

function parseSupervisorSignals(value: unknown): SupervisorSignals {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      expertiseDomains: [],
      preferredProjectType: "unspecified",
      coreTechnologies: [],
      studentSupportStrengths: [],
      pastProjectThemes: [],
      profileKeywords: [],
      summary: "",
    }
  }

  const raw = value as Record<string, unknown>

  return {
    expertiseDomains: Array.isArray(raw.expertiseDomains)
      ? raw.expertiseDomains.filter((item): item is string => typeof item === "string")
      : [],
    preferredProjectType:
      typeof raw.preferredProjectType === "string"
        ? raw.preferredProjectType
        : "unspecified",
    coreTechnologies: Array.isArray(raw.coreTechnologies)
      ? raw.coreTechnologies.filter((item): item is string => typeof item === "string")
      : [],
    studentSupportStrengths: Array.isArray(raw.studentSupportStrengths)
      ? raw.studentSupportStrengths.filter((item): item is string => typeof item === "string")
      : [],
    pastProjectThemes: Array.isArray(raw.pastProjectThemes)
      ? raw.pastProjectThemes.filter((item): item is string => typeof item === "string")
      : [],
    profileKeywords: Array.isArray(raw.profileKeywords)
      ? raw.profileKeywords.filter((item): item is string => typeof item === "string")
      : [],
    summary: typeof raw.summary === "string" ? raw.summary : "",
  }
}

function projectTypeAlignment(studentType: string, supervisorType: string) {
  const student = (studentType || "unspecified").toLowerCase()
  const supervisor = (supervisorType || "unspecified").toLowerCase()

  if (student === "unspecified" || supervisor === "unspecified") return 0.6
  if (student === supervisor) return 1
  if (student === "hybrid" || supervisor === "hybrid") return 0.75
  return 0.35
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim()
    return JSON.parse(cleaned)
  }
}

async function getGeminiEnhancedMatches(params: {
  supervisorProfile: {
    fullName: string
    email: string
    expertise: string[]
    summary: string
  }
  candidates: Array<{
    studentId: string
    fullName: string
    projectTitle: string
    projectStatus: string | null
    baselineScore: number
    baselineReasons: string[]
    evidenceTerms: string[]
  }>
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `
You are helping an academic supervisor identify the best student profiles to review.

Return ONLY valid JSON in this exact shape:
{
  "matches": [
    {
      "studentId": "string",
      "aiScore": 0,
      "reasons": ["reason 1", "reason 2", "reason 3"]
    }
  ]
}

Rules:
- aiScore must be an integer from 0 to 100.
- reasons must contain exactly 3 short and specific strings.
- Use fit between supervisor expertise and student project/profile signals.
- Mention concrete matching terms from evidenceTerms when possible.
- Do not invent facts not present in input.

Supervisor profile:
${JSON.stringify(params.supervisorProfile)}

Student candidates:
${JSON.stringify(params.candidates)}
`.trim()

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  })

  const text = response.text
  if (!text) return null

  const parsed = safeJsonParse(String(text).trim())
  if (!parsed || !Array.isArray(parsed.matches)) return null

  return parsed.matches as Array<{
    studentId: string
    aiScore: number
    reasons: string[]
  }>
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

    const settings = await getMatchingSettings(prisma)

    const supervisor = await db.supervisorProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        fullName: true,
        expertise: true,
        onboardingCompleted: true,
        onboardingSignals: true,
        maxCapacity: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    })

    if (!supervisor) {
      return NextResponse.json(
        { error: "Supervisor profile not found" },
        { status: 404 }
      )
    }

    if (!supervisor.onboardingCompleted) {
      return NextResponse.json(
        {
          error:
            "Complete supervisor onboarding first to generate student recommendations.",
        },
        { status: 400 }
      )
    }

    const supervisorSignals = parseSupervisorSignals(supervisor.onboardingSignals)

    const supervisorTerms = uniqueNormalizedPhrases(
      mergeUniqueTerms(
        splitCsv(supervisor.expertise),
        supervisorSignals.expertiseDomains,
        supervisorSignals.coreTechnologies,
        supervisorSignals.studentSupportStrengths,
        supervisorSignals.pastProjectThemes,
        supervisorSignals.profileKeywords
      )
    )

    const students = (await db.user.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        studentProfile: {
          is: {
            supervisorId: null,
            onboardingCompleted: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        studentProfile: {
          select: {
            fullName: true,
            skills: true,
            interests: true,
            onboardingSignals: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            keywords: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })) as Array<{
      id: string
      email: string
      studentProfile: {
        fullName: string | null
        skills: string | null
        interests: string | null
        onboardingSignals: unknown
      } | null
      project: {
        id: string
        title: string | null
        description: string | null
        keywords: string | null
        status: string | null
        createdAt: Date
      } | null
    }>

    const eligible = students.filter((student) => Boolean(student.studentProfile && student.project))

    if (eligible.length === 0) {
      return NextResponse.json(
        {
          matches: [],
          stats: {
            candidateCount: 0,
            hiddenByThreshold: 0,
          },
        },
        { status: 200 }
      )
    }

    const requestRows = await prisma.supervisionRequest.findMany({
      where: {
        supervisorId: payload.sub,
        studentId: {
          in: eligible.map((student) => student.id),
        },
      },
      select: {
        studentId: true,
        status: true,
      },
    })

    const requestStatusByStudent = new Map(
      requestRows.map((row) => [row.studentId, row.status] as const)
    )

    const baselineMatches: BaselineMatch[] = eligible.map((student) => {
      const profile = student.studentProfile!
      const project = student.project!
      const studentSignals = parseStudentSignals(profile.onboardingSignals)

      const projectTitle = project.title || "Untitled Project"
      const projectDescription = project.description || ""
      const projectKeywords = splitCsv(project.keywords)

      const titleTerms = extractMeaningfulTerms(projectTitle, 8)
      const descriptionTerms = extractMeaningfulTerms(projectDescription, 24)
      const keywordTerms = uniqueNormalizedPhrases(projectKeywords)

      const studentSkillTerms = uniqueNormalizedPhrases(
        mergeUniqueTerms(
          splitCsv(profile.skills),
          splitCsv(profile.interests),
          studentSignals.preferredDomains,
          studentSignals.existingSkills,
          studentSignals.learningGoals,
          studentSignals.interestKeywords
        )
      )

      const projectAlignment = computeAlignment(
        mergeUniqueTerms(titleTerms, descriptionTerms, keywordTerms),
        supervisorTerms
      )

      const profileAlignment = computeAlignment(studentSkillTerms, supervisorTerms)

      const learningAlignment = computeAlignment(
        uniqueNormalizedPhrases(studentSignals.learningGoals),
        supervisorTerms
      )

      const typeFit = projectTypeAlignment(
        studentSignals.desiredProjectType,
        supervisorSignals.preferredProjectType
      )

      const requestStatus = requestStatusByStudent.get(student.id) ?? null
      const requestBoost =
        requestStatus === "pending"
          ? 0.08
          : requestStatus === "declined"
          ? -0.04
          : 0

      const rawScore =
        projectAlignment.score * 0.5 +
        profileAlignment.score * 0.3 +
        learningAlignment.score * 0.15 +
        typeFit * 0.05 +
        requestBoost

      const scorePercent = Math.round(clamp01(rawScore) * 100)

      const reasons: string[] = []

      if (projectAlignment.matchedTerms.length > 0) {
        reasons.push(
          `Project themes align with ${projectAlignment.matchedTerms.slice(0, 3).join(", ")}.`
        )
      }

      if (profileAlignment.matchedTerms.length > 0) {
        reasons.push(
          `Student profile aligns in ${profileAlignment.matchedTerms.slice(0, 3).join(", ")}.`
        )
      }

      if (learningAlignment.matchedTerms.length > 0) {
        reasons.push(
          `Learning goals overlap with your strengths in ${learningAlignment.matchedTerms
            .slice(0, 2)
            .join(", ")}.`
        )
      }

      if (requestStatus === "pending") {
        reasons.push("This student already sent you a pending supervision request.")
      }

      if (
        studentSignals.desiredProjectType !== "unspecified" &&
        supervisorSignals.preferredProjectType !== "unspecified" &&
        typeFit >= 0.75
      ) {
        reasons.push(
          `Project style fit is strong (${studentSignals.desiredProjectType}).`
        )
      }

      if (reasons.length === 0) {
        reasons.push(
          "General fit is promising based on current project scope and profile signals."
        )
      }

      const fullName = profile.fullName || student.email.split("@")[0] || "Student"

      return {
        student: {
          id: student.id,
          fullName,
          email: student.email,
          projectTitle,
          projectStatus: project.status,
          requestStatus,
        },
        matchScore: scorePercent,
        matchReasons: reasons.slice(0, 3),
        source: "rule_based",
        evidenceTerms: mergeUniqueTerms(
          projectAlignment.matchedTerms,
          profileAlignment.matchedTerms,
          learningAlignment.matchedTerms
        ).slice(0, 6),
      }
    })

    const thresholdFiltered = baselineMatches.filter(
      (item) =>
        item.matchScore >= settings.minMatchThreshold ||
        item.student.requestStatus === "pending"
    )

    const rankedThresholdMatches = [...thresholdFiltered].sort((a, b) => {
      if (
        a.student.requestStatus === "pending" &&
        b.student.requestStatus !== "pending"
      ) {
        return -1
      }
      if (
        a.student.requestStatus !== "pending" &&
        b.student.requestStatus === "pending"
      ) {
        return 1
      }
      return b.matchScore - a.matchScore
    })

    const topCandidates = rankedThresholdMatches.slice(
      0,
      Math.max(5, settings.recommendationCount)
    )

    const geminiMatches =
      settings.aiExplanationEnabled && topCandidates.length > 0
        ? await getGeminiEnhancedMatches({
            supervisorProfile: {
              fullName: supervisor.fullName || "Supervisor",
              email: supervisor.user.email,
              expertise: splitCsv(supervisor.expertise),
              summary: supervisorSignals.summary,
            },
            candidates: topCandidates.map((item) => ({
              studentId: item.student.id,
              fullName: item.student.fullName,
              projectTitle: item.student.projectTitle,
              projectStatus: item.student.projectStatus,
              baselineScore: item.matchScore,
              baselineReasons: item.matchReasons,
              evidenceTerms: item.evidenceTerms,
            })),
          }).catch((err) => {
            console.error("Gemini supervisor matching failed:", err)
            return null
          })
        : null

    const matches = rankedThresholdMatches
      .map((item) => {
        const aiMatch = geminiMatches?.find((g) => g.studentId === item.student.id)

        if (!aiMatch || !settings.aiExplanationEnabled) {
          return {
            student: item.student,
            matchScore: item.matchScore,
            matchReasons: item.matchReasons,
            source: "rule_based" as const,
          }
        }

        const aiScore = Math.max(0, Math.min(100, Math.round(aiMatch.aiScore)))
        const blendedScore = Math.round(item.matchScore * 0.7 + aiScore * 0.3)

        return {
          student: item.student,
          matchScore: blendedScore,
          matchReasons:
            Array.isArray(aiMatch.reasons) && aiMatch.reasons.length > 0
              ? aiMatch.reasons.slice(0, 3)
              : item.matchReasons,
          source: "gemini" as const,
        }
      })
      .sort((a, b) => {
        if (a.student.requestStatus === "pending" && b.student.requestStatus !== "pending") {
          return -1
        }
        if (a.student.requestStatus !== "pending" && b.student.requestStatus === "pending") {
          return 1
        }
        return b.matchScore - a.matchScore
      })
      .slice(0, settings.recommendationCount)

    return NextResponse.json(
      {
        matches,
        settings: {
          recommendationCount: settings.recommendationCount,
          minMatchThreshold: settings.minMatchThreshold,
          aiExplanationEnabled: settings.aiExplanationEnabled,
        },
        stats: {
          candidateCount: eligible.length,
          hiddenByThreshold: baselineMatches.length - thresholdFiltered.length,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
