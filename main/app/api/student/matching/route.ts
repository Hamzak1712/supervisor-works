import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"
import { GoogleGenAI } from "@google/genai"

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

function mergeUniqueTerms(...collections: string[][]): string[] {
  const set = new Set<string>()
  collections.forEach((collection) => {
    collection.forEach((item) => set.add(item))
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

function computeAlignment(sourceTerms: string[], expertiseTerms: string[]) {
  if (sourceTerms.length === 0 || expertiseTerms.length === 0) {
    return {
      score: 0,
      matchedTerms: [] as string[],
      coverage: 0,
    }
  }

  const bestMatches = sourceTerms.map((source) => {
    const similarity = expertiseTerms.reduce((best, expertise) => {
      return Math.max(best, phraseSimilarity(source, expertise))
    }, 0)

    return {
      source,
      similarity,
    }
  })

  const similarityAverage =
    bestMatches.reduce((sum, item) => sum + item.similarity, 0) /
    sourceTerms.length
  const matched = bestMatches.filter((item) => item.similarity >= 0.45)
  const coverage = matched.length / sourceTerms.length

  return {
    score: similarityAverage * 0.65 + coverage * 0.35,
    matchedTerms: matched
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.source)
      .slice(0, 5),
    coverage,
  }
}

function scoreMatch(params: {
  projectTitle: string
  projectDescription: string
  projectKeywords: string[]
  studentSkills: string[]
  studentInterests: string[]
  supervisorExpertise: string[]
  maxCapacity: number
  assignedStudents: number
}) {
  const {
    projectTitle,
    projectDescription,
    projectKeywords,
    studentSkills,
    studentInterests,
    supervisorExpertise,
    maxCapacity,
    assignedStudents,
  } = params

  const expertiseTerms = uniqueNormalizedPhrases(supervisorExpertise)
  const titleTerms = extractMeaningfulTerms(projectTitle, 8)
  const descriptionTerms = extractMeaningfulTerms(projectDescription, 20)
  const keywordTerms = uniqueNormalizedPhrases(projectKeywords)
  const skillTerms = uniqueNormalizedPhrases(studentSkills)
  const interestTerms = uniqueNormalizedPhrases(studentInterests)

  const titleAlignment = computeAlignment(titleTerms, expertiseTerms)
  const keywordAlignment = computeAlignment(keywordTerms, expertiseTerms)
  const descriptionAlignment = computeAlignment(descriptionTerms, expertiseTerms)
  const skillAlignment = computeAlignment(skillTerms, expertiseTerms)
  const interestAlignment = computeAlignment(interestTerms, expertiseTerms)

  const weightedComponents = [
    { weight: 0.22, value: titleAlignment.score, enabled: titleTerms.length > 0 },
    { weight: 0.24, value: keywordAlignment.score, enabled: keywordTerms.length > 0 },
    {
      weight: 0.2,
      value: descriptionAlignment.score,
      enabled: descriptionTerms.length > 0,
    },
    { weight: 0.16, value: skillAlignment.score, enabled: skillTerms.length > 0 },
    { weight: 0.14, value: interestAlignment.score, enabled: interestTerms.length > 0 },
  ]

  const normalizedCapacity = maxCapacity > 0 ? maxCapacity : 1
  const remainingSlots = Math.max(0, normalizedCapacity - assignedStudents)
  const capacityRatio = remainingSlots / normalizedCapacity
  const capacityScore = 0.35 + capacityRatio * 0.65
  const capacityWeight = 0.04

  const activeComponents = weightedComponents.filter((component) => component.enabled)
  const modelWeight =
    activeComponents.reduce((sum, component) => sum + component.weight, 0) +
    capacityWeight

  const weightedSum =
    activeComponents.reduce(
      (sum, component) => sum + component.value * component.weight,
      0
    ) +
    capacityScore * capacityWeight

  const rawScore = modelWeight > 0 ? weightedSum / modelWeight : 0
  const scorePercent = Math.round(Math.max(0, Math.min(1, rawScore)) * 100)

  const focusTerms = mergeUniqueTerms(
    titleAlignment.matchedTerms,
    keywordAlignment.matchedTerms
  ).slice(0, 3)
  const profileTerms = mergeUniqueTerms(
    skillAlignment.matchedTerms,
    interestAlignment.matchedTerms
  ).slice(0, 3)
  const contextTerms = descriptionAlignment.matchedTerms.slice(0, 3)

  const reasons: string[] = []

  if (focusTerms.length > 0) {
    reasons.push(
      `Project focus aligns with supervisor expertise in ${focusTerms.join(", ")}.`
    )
  }

  if (profileTerms.length > 0) {
    reasons.push(
      `Student profile alignment is strong across ${profileTerms.join(", ")}.`
    )
  }

  if (contextTerms.length > 0) {
    reasons.push(
      `Project description themes overlap in ${contextTerms.join(", ")}.`
    )
  }

  if (reasons.length < 3) {
    reasons.push(
      `Capacity signal: ${remainingSlots}/${normalizedCapacity} supervision slots currently open.`
    )
  }

  if (reasons.length < 3) {
    reasons.push(
      "Overall fit combines project text relevance, profile alignment, and supervision availability."
    )
  }

  return {
    scorePercent,
    reasons: reasons.slice(0, 3),
    evidence: {
      focusTerms,
      profileTerms,
      contextTerms,
      remainingSlots,
      normalizedCapacity,
      coverage: {
        title: titleAlignment.coverage,
        keywords: keywordAlignment.coverage,
        description: descriptionAlignment.coverage,
        skills: skillAlignment.coverage,
        interests: interestAlignment.coverage,
      },
    },
  }
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
  projectTitle: string
  projectDescription: string
  projectKeywords: string[]
  studentSkills: string[]
  studentInterests: string[]
  candidates: Array<{
    supervisorId: string
    fullName: string
    email: string
    expertise: string[]
    maxCapacity: number
    assignedStudents: number
    remainingSlots: number
    baselineScore: number
    baselineReasons: string[]
    evidenceTerms: string[]
  }>
}) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return null
  }

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `
You are helping rank academic supervisors for a final year computing project.

Return ONLY valid JSON in this exact shape:
{
  "matches": [
    {
      "supervisorId": "string",
      "aiScore": 0,
      "reasons": ["reason 1", "reason 2", "reason 3"]
    }
  ]
}

Rules:
- aiScore must be an integer from 0 to 100.
- reasons must contain exactly 3 short, specific strings.
- Base your judgment on project fit, research fit, skill alignment, and keyword overlap.
- Prefer supervisors whose expertise is clearly relevant.
- Do not invent facts not present in the input.
- Keep all reasons concise and professional.
- Reasons MUST mention concrete matching terms from the provided evidenceTerms when available.

Student project:
${JSON.stringify({
  title: params.projectTitle,
  description: params.projectDescription,
  keywords: params.projectKeywords,
  studentSkills: params.studentSkills,
  studentInterests: params.studentInterests,
})}

Supervisor candidates:
${JSON.stringify(params.candidates)}
`.trim()

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  })

  const text = response.text

  if (!text) {
    return null
  }

  const parsed = safeJsonParse(String(text).trim())

  if (!parsed || !Array.isArray(parsed.matches)) {
    return null
  }

  return parsed.matches as Array<{
    supervisorId: string
    aiScore: number
    reasons: string[]
  }>
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        fullName: true,
        skills: true,
        interests: true,
      },
    })

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: {
        title: true,
        description: true,
        keywords: true,
        status: true,
      },
    })

    const requests = await prisma.supervisionRequest.findMany({
      where: { studentId: payload.sub },
      select: {
        supervisorId: true,
        status: true,
      },
    })

    const requestStatusBySupervisor = new Map(
      requests.map((r) => [r.supervisorId, r.status] as const)
    )

    const assignedPairs = await prisma.studentProfile.findMany({
      where: {
        supervisorId: {
          not: null,
        },
      },
      select: {
        supervisorId: true,
      },
    })

    const assignedCountBySupervisor = new Map<string, number>()
    assignedPairs.forEach((entry) => {
      if (!entry.supervisorId) return
      assignedCountBySupervisor.set(
        entry.supervisorId,
        (assignedCountBySupervisor.get(entry.supervisorId) ?? 0) + 1
      )
    })

    const supervisors = await prisma.supervisorProfile.findMany({
      select: {
        id: true,
        userId: true,
        fullName: true,
        expertise: true,
        maxCapacity: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Create a project before running supervisor matching" },
        { status: 400 }
      )
    }

    const studentSkills = splitCsv(studentProfile?.skills)
    const studentInterests = splitCsv(studentProfile?.interests)
    const projectKeywords = splitCsv(project.keywords)
    const projectDescription = project.description ?? ""
    const projectTitle = project.title ?? "Untitled Project"

    const baselineMatches = supervisors
      .map((supervisor) => {
        const supervisorExpertise = splitCsv(supervisor.expertise)
        const assignedStudents =
          assignedCountBySupervisor.get(supervisor.userId) ?? 0

        const scored = scoreMatch({
          projectTitle,
          projectDescription,
          projectKeywords,
          studentSkills,
          studentInterests,
          supervisorExpertise,
          maxCapacity: supervisor.maxCapacity,
          assignedStudents,
        })

        return {
          supervisor: {
            id: supervisor.id,
            userId: supervisor.userId,
            fullName: supervisor.fullName,
            email: supervisor.user.email,
            expertise: supervisorExpertise,
            maxCapacity: supervisor.maxCapacity,
            assignedStudents,
            requestStatus:
              requestStatusBySupervisor.get(supervisor.userId) ?? null,
          },
          baselineScore: scored.scorePercent,
          matchScore: scored.scorePercent,
          matchReasons: scored.reasons,
          evidenceTerms: mergeUniqueTerms(
            scored.evidence.focusTerms,
            scored.evidence.profileTerms,
            scored.evidence.contextTerms
          ).slice(0, 6),
          remainingSlots: scored.evidence.remainingSlots,
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore)

    const topCandidates = baselineMatches.slice(0, 5)

    const geminiMatches = await getGeminiEnhancedMatches({
      projectTitle,
      projectDescription,
      projectKeywords,
      studentSkills,
      studentInterests,
      candidates: topCandidates.map((item) => ({
        supervisorId: item.supervisor.id,
        fullName: item.supervisor.fullName || "Unnamed Supervisor",
        email: item.supervisor.email,
        expertise: item.supervisor.expertise,
        maxCapacity: item.supervisor.maxCapacity,
        assignedStudents: item.supervisor.assignedStudents,
        remainingSlots: item.remainingSlots,
        baselineScore: item.matchScore,
        baselineReasons: item.matchReasons,
        evidenceTerms: item.evidenceTerms,
      })),
    }).catch((err) => {
      console.error("Gemini matching failed:", err)
      return null
    })

    const finalMatches = baselineMatches.map((item) => {
      const aiMatch = geminiMatches?.find(
        (g) => g.supervisorId === item.supervisor.id
      )

      if (!aiMatch) {
        return {
          supervisor: item.supervisor,
          matchScore: item.matchScore,
          matchReasons: item.matchReasons,
          source: "rule_based",
        }
      }

      const aiScore = Math.max(0, Math.min(100, Math.round(aiMatch.aiScore)))
      const blendedScore = Math.round(item.matchScore * 0.65 + aiScore * 0.35)

      return {
        supervisor: item.supervisor,
        matchScore: blendedScore,
        matchReasons:
          Array.isArray(aiMatch.reasons) && aiMatch.reasons.length > 0
            ? aiMatch.reasons.slice(0, 3)
            : item.matchReasons,
        source: "gemini",
      }
    })

    finalMatches.sort((a, b) => b.matchScore - a.matchScore)

    return NextResponse.json(
      {
        student: {
          fullName: studentProfile?.fullName ?? null,
        },
        project: {
          title: project.title,
          keywords: projectKeywords,
          status: project.status,
        },
        matches: finalMatches,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
