import { PrismaClient } from "@prisma/client"
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

export type MatchingSettings = {
  semanticWeight: number
  keywordWeight: number
  capacityWeight: number
  responseSpeedWeight: number
  minMatchThreshold: number
  recommendationCount: number
  aiExplanationEnabled: boolean
}

export type StudentMatchResult = {
  student: {
    fullName: string | null
  }
  project: {
    title: string | null
    keywords: string[]
    status: string | null
  }
  matches: Array<{
    supervisor: {
      id: string
      userId: string
      fullName: string | null
      email: string
      expertise: string[]
      maxCapacity: number
      assignedStudents: number
      requestStatus: string | null
    }
    matchScore: number
    matchReasons: string[]
    source: "rule_based" | "gemini"
  }>
  settings: MatchingSettings
  stats: {
    hiddenByThreshold: number
    blacklistedFiltered: number
    candidateCount: number
  }
}

type OnboardingSignalSet = {
  preferredDomains?: string[]
  desiredProjectType?: string
  existingSkills?: string[]
  learningGoals?: string[]
  interestKeywords?: string[]
  hasInitialIdea?: boolean
  summary?: string
}

type SupervisorOnboardingSignalSet = {
  expertiseDomains?: string[]
  preferredProjectType?: string
  coreTechnologies?: string[]
  studentSupportStrengths?: string[]
  supervisionStyle?: string
  pastProjectThemes?: string[]
  profileKeywords?: string[]
  summary?: string
}

const DEFAULT_SETTINGS: MatchingSettings = {
  semanticWeight: 40,
  keywordWeight: 30,
  capacityWeight: 20,
  responseSpeedWeight: 10,
  minMatchThreshold: 40,
  recommendationCount: 5,
  aiExplanationEnabled: true,
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
      .slice(0, 6),
    coverage,
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

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseOnboardingSignals(value: unknown): OnboardingSignalSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>

  return {
    preferredDomains: normalizeStringArray(raw.preferredDomains),
    desiredProjectType:
      typeof raw.desiredProjectType === "string"
        ? raw.desiredProjectType
        : undefined,
    existingSkills: normalizeStringArray(raw.existingSkills),
    learningGoals: normalizeStringArray(raw.learningGoals),
    interestKeywords: normalizeStringArray(raw.interestKeywords),
    hasInitialIdea:
      typeof raw.hasInitialIdea === "boolean" ? raw.hasInitialIdea : undefined,
    summary: typeof raw.summary === "string" ? raw.summary.trim() : undefined,
  }
}

function parseSupervisorOnboardingSignals(
  value: unknown
): SupervisorOnboardingSignalSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>

  return {
    expertiseDomains: normalizeStringArray(raw.expertiseDomains),
    preferredProjectType:
      typeof raw.preferredProjectType === "string"
        ? raw.preferredProjectType
        : undefined,
    coreTechnologies: normalizeStringArray(raw.coreTechnologies),
    studentSupportStrengths: normalizeStringArray(raw.studentSupportStrengths),
    supervisionStyle:
      typeof raw.supervisionStyle === "string"
        ? raw.supervisionStyle.trim()
        : undefined,
    pastProjectThemes: normalizeStringArray(raw.pastProjectThemes),
    profileKeywords: normalizeStringArray(raw.profileKeywords),
    summary: typeof raw.summary === "string" ? raw.summary.trim() : undefined,
  }
}

function normalizeWeightSettings(settings: MatchingSettings): MatchingSettings {
  const sum =
    settings.semanticWeight +
    settings.keywordWeight +
    settings.capacityWeight +
    settings.responseSpeedWeight

  if (sum === 100) return settings

  if (sum <= 0) return DEFAULT_SETTINGS

  const semanticWeight = Math.round((settings.semanticWeight / sum) * 100)
  const keywordWeight = Math.round((settings.keywordWeight / sum) * 100)
  const capacityWeight = Math.round((settings.capacityWeight / sum) * 100)
  const responseSpeedWeight =
    100 - semanticWeight - keywordWeight - capacityWeight

  return {
    ...settings,
    semanticWeight,
    keywordWeight,
    capacityWeight,
    responseSpeedWeight,
  }
}

function responseSpeedScore(avgResponseDays: number | null): number {
  if (avgResponseDays === null) return 0.6
  if (avgResponseDays <= 2) return 1
  if (avgResponseDays <= 5) return 0.85
  if (avgResponseDays <= 7) return 0.7
  if (avgResponseDays <= 14) return 0.4
  return 0.2
}

function projectTypeAlignment(studentType: string, supervisorType: string): number {
  const student = (studentType || "unspecified").toLowerCase()
  const supervisor = (supervisorType || "unspecified").toLowerCase()

  if (student === "unspecified" || supervisor === "unspecified") return 0.6
  if (student === supervisor) return 1
  if (student === "hybrid" || supervisor === "hybrid") return 0.75
  return 0.35
}

function scoreMatch(params: {
  projectTitle: string
  projectDescription: string
  projectKeywords: string[]
  studentSkills: string[]
  studentInterests: string[]
  onboardingDomains: string[]
  onboardingLearningGoals: string[]
  desiredProjectType: string
  supervisorPreferredProjectType: string
  supervisorExpertise: string[]
  maxCapacity: number
  assignedStudents: number
  avgResponseDays: number | null
  settings: MatchingSettings
}) {
  const {
    projectTitle,
    projectDescription,
    projectKeywords,
    studentSkills,
    studentInterests,
    onboardingDomains,
    onboardingLearningGoals,
    desiredProjectType,
    supervisorPreferredProjectType,
    supervisorExpertise,
    maxCapacity,
    assignedStudents,
    avgResponseDays,
    settings,
  } = params

  const expertiseTerms = uniqueNormalizedPhrases(supervisorExpertise)
  const titleTerms = extractMeaningfulTerms(projectTitle, 8)
  const descriptionTerms = extractMeaningfulTerms(projectDescription, 20)
  const keywordTerms = uniqueNormalizedPhrases(projectKeywords)
  const skillTerms = uniqueNormalizedPhrases(studentSkills)
  const interestTerms = uniqueNormalizedPhrases(studentInterests)
  const onboardingDomainTerms = uniqueNormalizedPhrases(onboardingDomains)
  const onboardingLearningTerms = uniqueNormalizedPhrases(onboardingLearningGoals)

  const titleAlignment = computeAlignment(titleTerms, expertiseTerms)
  const descriptionAlignment = computeAlignment(descriptionTerms, expertiseTerms)
  const keywordAlignment = computeAlignment(keywordTerms, expertiseTerms)
  const skillAlignment = computeAlignment(skillTerms, expertiseTerms)
  const interestAlignment = computeAlignment(interestTerms, expertiseTerms)
  const domainAlignment = computeAlignment(onboardingDomainTerms, expertiseTerms)
  const learningGoalAlignment = computeAlignment(onboardingLearningTerms, expertiseTerms)

  const semanticSignals = [
    { value: titleAlignment.score, enabled: titleTerms.length > 0, weight: 0.24 },
    { value: descriptionAlignment.score, enabled: descriptionTerms.length > 0, weight: 0.24 },
    { value: skillAlignment.score, enabled: skillTerms.length > 0, weight: 0.14 },
    { value: interestAlignment.score, enabled: interestTerms.length > 0, weight: 0.14 },
    { value: domainAlignment.score, enabled: onboardingDomainTerms.length > 0, weight: 0.12 },
    { value: learningGoalAlignment.score, enabled: onboardingLearningTerms.length > 0, weight: 0.12 },
  ]

  const semanticWeightSum = semanticSignals
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.weight, 0)

  const semanticBaseScore =
    semanticWeightSum > 0
      ? semanticSignals
          .filter((item) => item.enabled)
          .reduce((sum, item) => sum + item.value * item.weight, 0) /
        semanticWeightSum
      : 0

  const projectTypeScore = projectTypeAlignment(
    desiredProjectType,
    supervisorPreferredProjectType
  )

  const semanticScore =
    desiredProjectType !== "unspecified" ||
    supervisorPreferredProjectType !== "unspecified"
      ? semanticBaseScore * 0.9 + projectTypeScore * 0.1
      : semanticBaseScore

  const keywordSignals = [
    {
      value: keywordAlignment.score,
      enabled: keywordTerms.length > 0,
      weight: onboardingDomainTerms.length > 0 ? 0.7 : 1,
    },
    {
      value: domainAlignment.score,
      enabled: onboardingDomainTerms.length > 0,
      weight: 0.3,
    },
  ]

  const keywordWeightSum = keywordSignals
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.weight, 0)

  const keywordScore =
    keywordWeightSum > 0
      ? keywordSignals
          .filter((item) => item.enabled)
          .reduce((sum, item) => sum + item.value * item.weight, 0) /
        keywordWeightSum
      : 0

  const normalizedCapacity = maxCapacity > 0 ? maxCapacity : 1
  const remainingSlots = Math.max(0, normalizedCapacity - assignedStudents)
  const capacityRatio = remainingSlots / normalizedCapacity
  const capacityScore = 0.25 + capacityRatio * 0.75

  const responseScore = responseSpeedScore(avgResponseDays)

  const normalizedSettings = normalizeWeightSettings(settings)

  const finalRawScore =
    semanticScore * (normalizedSettings.semanticWeight / 100) +
    keywordScore * (normalizedSettings.keywordWeight / 100) +
    capacityScore * (normalizedSettings.capacityWeight / 100) +
    responseScore * (normalizedSettings.responseSpeedWeight / 100)

  const scorePercent = Math.round(Math.max(0, Math.min(1, finalRawScore)) * 100)

  const focusTerms = mergeUniqueTerms(
    titleAlignment.matchedTerms,
    keywordAlignment.matchedTerms,
    domainAlignment.matchedTerms
  ).slice(0, 3)
  const profileTerms = mergeUniqueTerms(
    skillAlignment.matchedTerms,
    interestAlignment.matchedTerms,
    learningGoalAlignment.matchedTerms
  ).slice(0, 3)
  const domainTerms = domainAlignment.matchedTerms.slice(0, 3)

  const primaryReasons: string[] = []

  if (focusTerms.length > 0) {
    primaryReasons.push(`Project topics align with ${focusTerms.join(", ")}.`)
  }

  if (profileTerms.length > 0) {
    primaryReasons.push(`Student profile overlap is strong in ${profileTerms.join(", ")}.`)
  }

  if (domainTerms.length > 0) {
    primaryReasons.push(
      `Onboarding interests align with supervisor strengths in ${domainTerms.join(", ")}.`
    )
  }

  if (
    desiredProjectType &&
    desiredProjectType !== "unspecified" &&
    supervisorPreferredProjectType &&
    supervisorPreferredProjectType !== "unspecified"
  ) {
    if (projectTypeScore >= 0.9) {
      primaryReasons.push(
        `Project style preference aligns (${desiredProjectType}).`
      )
    } else if (projectTypeScore >= 0.7) {
      primaryReasons.push(
        `Project style fit is strong (student: ${desiredProjectType}, supervisor: ${supervisorPreferredProjectType}).`
      )
    }
  } else if (desiredProjectType && desiredProjectType !== "unspecified") {
    primaryReasons.push(
      `Preferred project style (${desiredProjectType}) was included in this ranking.`
    )
  }

  const capacityReason =
    `Capacity fit: ${remainingSlots}/${normalizedCapacity} slots available; avg response ${
      avgResponseDays === null ? "unknown" : `${avgResponseDays.toFixed(1)} days`
    }.`

  const reasons = [...primaryReasons.slice(0, 2), capacityReason].slice(0, 3)

  return {
    scorePercent,
    reasons,
    evidenceTerms: mergeUniqueTerms(
      focusTerms,
      profileTerms,
      domainTerms,
      descriptionAlignment.matchedTerms.slice(0, 2)
    ).slice(0, 6),
  }
}

async function getGeminiEnhancedMatches(params: {
  projectTitle: string
  projectDescription: string
  projectKeywords: string[]
  studentSkills: string[]
  studentInterests: string[]
  onboardingSignals: OnboardingSignalSet | null
  candidates: Array<{
    supervisorId: string
    fullName: string
    email: string
    expertise: string[]
    maxCapacity: number
    assignedStudents: number
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
- Base your judgment on project fit, research fit, skill alignment, onboarding preferences, and keyword overlap.
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
  onboardingSignals: params.onboardingSignals,
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

export async function getMatchingSettings(prisma: PrismaClient): Promise<MatchingSettings> {
  const config = await prisma.matchingConfig.findUnique({
    where: { id: "global" },
  })

  if (!config) {
    const created = await prisma.matchingConfig.create({
      data: {
        id: "global",
        ...DEFAULT_SETTINGS,
      },
    })

    return {
      semanticWeight: created.semanticWeight,
      keywordWeight: created.keywordWeight,
      capacityWeight: created.capacityWeight,
      responseSpeedWeight: created.responseSpeedWeight,
      minMatchThreshold: created.minMatchThreshold,
      recommendationCount: created.recommendationCount,
      aiExplanationEnabled: created.aiExplanationEnabled,
    }
  }

  return {
    semanticWeight: config.semanticWeight,
    keywordWeight: config.keywordWeight,
    capacityWeight: config.capacityWeight,
    responseSpeedWeight: config.responseSpeedWeight,
    minMatchThreshold: config.minMatchThreshold,
    recommendationCount: config.recommendationCount,
    aiExplanationEnabled: config.aiExplanationEnabled,
  }
}

async function getResponseDaysBySupervisor(prisma: PrismaClient) {
  const respondedRequests = await prisma.supervisionRequest.findMany({
    where: {
      respondedAt: {
        not: null,
      },
    },
    select: {
      supervisorId: true,
      createdAt: true,
      respondedAt: true,
    },
  })

  const responseMap = new Map<string, number[]>()

  respondedRequests.forEach((request) => {
    if (!request.respondedAt) return
    const days =
      (request.respondedAt.getTime() - request.createdAt.getTime()) /
      (1000 * 60 * 60 * 24)
    const arr = responseMap.get(request.supervisorId) ?? []
    arr.push(days)
    responseMap.set(request.supervisorId, arr)
  })

  const averageMap = new Map<string, number | null>()
  responseMap.forEach((values, supervisorId) => {
    if (values.length === 0) {
      averageMap.set(supervisorId, null)
      return
    }
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    averageMap.set(supervisorId, avg)
  })

  return averageMap
}

export async function generateRecommendationsForStudent(
  prisma: PrismaClient,
  studentId: string
): Promise<StudentMatchResult> {
  const settings = await getMatchingSettings(prisma)

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
    select: {
      fullName: true,
      skills: true,
      interests: true,
      onboardingSignals: true,
    },
  })

  const project = await prisma.project.findUnique({
    where: { studentId },
    select: {
      title: true,
      description: true,
      keywords: true,
      status: true,
    },
  })

  if (!project) {
    throw new Error("Create a project before running supervisor matching")
  }

  const [requests, blacklistPairs, assignedPairs, responseDaysMap] = await Promise.all([
    prisma.supervisionRequest.findMany({
      where: { studentId },
      select: {
        supervisorId: true,
        status: true,
      },
    }),
    prisma.matchingBlacklist.findMany({
      where: { studentId },
      select: {
        supervisorId: true,
      },
    }),
    prisma.studentProfile.findMany({
      where: {
        supervisorId: {
          not: null,
        },
      },
      select: {
        supervisorId: true,
      },
    }),
    getResponseDaysBySupervisor(prisma),
  ])

  const requestStatusBySupervisor = new Map(
    requests.map((r) => [r.supervisorId, r.status] as const)
  )

  const blacklistedSupervisorIds = new Set(
    blacklistPairs.map((pair) => pair.supervisorId)
  )

  const assignedCountBySupervisor = new Map<string, number>()
  assignedPairs.forEach((entry) => {
    if (!entry.supervisorId) return
    assignedCountBySupervisor.set(
      entry.supervisorId,
      (assignedCountBySupervisor.get(entry.supervisorId) ?? 0) + 1
    )
  })

  const supervisors = (await (prisma as any).supervisorProfile.findMany({
    where: {
      onboardingCompleted: true,
      acceptingStudents: true,
      user: {
        role: "SUPERVISOR",
        status: "ACTIVE",
      },
      userId: {
        notIn: Array.from(blacklistedSupervisorIds),
      },
    },
    select: {
      id: true,
      userId: true,
      fullName: true,
      expertise: true,
      onboardingSignals: true,
      maxCapacity: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  })) as Array<{
    id: string
    userId: string
    fullName: string | null
    expertise: string | null
    onboardingSignals: unknown
    maxCapacity: number
    user: { email: string }
  }>

  const studentSkills = splitCsv(studentProfile?.skills)
  const studentInterests = splitCsv(studentProfile?.interests)
  const onboardingSignals = parseOnboardingSignals(studentProfile?.onboardingSignals)
  const onboardingDomains = onboardingSignals?.preferredDomains ?? []
  const onboardingLearningGoals = onboardingSignals?.learningGoals ?? []
  const onboardingSkills = onboardingSignals?.existingSkills ?? []
  const onboardingKeywords = onboardingSignals?.interestKeywords ?? []
  const desiredProjectType = onboardingSignals?.desiredProjectType ?? "unspecified"

  const projectKeywords = splitCsv(project.keywords)
  const enrichedProjectKeywords = mergeUniqueTerms(projectKeywords, onboardingKeywords, onboardingDomains)
  const enrichedStudentSkills = mergeUniqueTerms(studentSkills, onboardingSkills)
  const enrichedStudentInterests = mergeUniqueTerms(
    studentInterests,
    onboardingDomains,
    onboardingLearningGoals
  )
  const projectDescription = [project.description ?? "", onboardingSignals?.summary || ""]
    .filter(Boolean)
    .join("\n\n")
  const projectTitle = project.title ?? "Untitled Project"

  const baselineMatches = supervisors
    .map((supervisor) => {
      const supervisorExpertise = splitCsv(supervisor.expertise)
      const supervisorSignals = parseSupervisorOnboardingSignals(
        supervisor.onboardingSignals
      )
      const enrichedSupervisorExpertise = mergeUniqueTerms(
        supervisorExpertise,
        supervisorSignals?.expertiseDomains ?? [],
        supervisorSignals?.coreTechnologies ?? [],
        supervisorSignals?.pastProjectThemes ?? [],
        supervisorSignals?.profileKeywords ?? []
      )
      const supervisorPreferredProjectType =
        supervisorSignals?.preferredProjectType ?? "unspecified"
      const assignedStudents =
        assignedCountBySupervisor.get(supervisor.userId) ?? 0
      const avgResponseDays = responseDaysMap.get(supervisor.userId) ?? null

      const scored = scoreMatch({
        projectTitle,
        projectDescription,
        projectKeywords: enrichedProjectKeywords,
        studentSkills: enrichedStudentSkills,
        studentInterests: enrichedStudentInterests,
        onboardingDomains,
        onboardingLearningGoals,
        desiredProjectType,
        supervisorPreferredProjectType,
        supervisorExpertise: enrichedSupervisorExpertise,
        maxCapacity: supervisor.maxCapacity,
        assignedStudents,
        avgResponseDays,
        settings,
      })

      return {
        supervisor: {
          id: supervisor.id,
          userId: supervisor.userId,
          fullName: supervisor.fullName,
          email: supervisor.user.email,
          expertise: enrichedSupervisorExpertise,
          maxCapacity: supervisor.maxCapacity,
          assignedStudents,
          requestStatus:
            requestStatusBySupervisor.get(supervisor.userId) ?? null,
        },
        baselineScore: scored.scorePercent,
        matchScore: scored.scorePercent,
        matchReasons: scored.reasons,
        evidenceTerms: scored.evidenceTerms,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)

  const thresholdFiltered = baselineMatches.filter(
    (item) => item.matchScore >= settings.minMatchThreshold
  )

  const topCandidates = thresholdFiltered.slice(0, Math.max(5, settings.recommendationCount))

  const geminiMatches =
    settings.aiExplanationEnabled && topCandidates.length > 0
      ? await getGeminiEnhancedMatches({
          projectTitle,
          projectDescription,
          projectKeywords: enrichedProjectKeywords,
          studentSkills: enrichedStudentSkills,
          studentInterests: enrichedStudentInterests,
          onboardingSignals,
          candidates: topCandidates.map((item) => ({
            supervisorId: item.supervisor.id,
            fullName: item.supervisor.fullName || "Unnamed Supervisor",
            email: item.supervisor.email,
            expertise: item.supervisor.expertise,
            maxCapacity: item.supervisor.maxCapacity,
            assignedStudents: item.supervisor.assignedStudents,
            baselineScore: item.matchScore,
            baselineReasons: item.matchReasons,
            evidenceTerms: item.evidenceTerms,
          })),
        }).catch((err) => {
          console.error("Gemini matching failed:", err)
          return null
        })
      : null

  const finalMatches = thresholdFiltered
    .map((item) => {
      const aiMatch = geminiMatches?.find(
        (g) => g.supervisorId === item.supervisor.id
      )

      if (!aiMatch || !settings.aiExplanationEnabled) {
        return {
          supervisor: item.supervisor,
          matchScore: item.matchScore,
          matchReasons: item.matchReasons,
          source: "rule_based" as const,
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
        source: "gemini" as const,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, settings.recommendationCount)

  await prisma.matchRecommendation.deleteMany({
    where: { studentId },
  })

  if (finalMatches.length > 0) {
    await prisma.matchRecommendation.createMany({
      data: finalMatches.map((match) => ({
        studentId,
        supervisorId: match.supervisor.userId,
        score: match.matchScore,
        reasons: match.matchReasons,
        source: match.source,
      })),
    })
  }

  return {
    student: {
      fullName: studentProfile?.fullName ?? null,
    },
    project: {
      title: project.title,
      keywords: projectKeywords,
      status: project.status,
    },
    matches: finalMatches,
    settings,
    stats: {
      hiddenByThreshold: baselineMatches.length - thresholdFiltered.length,
      blacklistedFiltered: blacklistedSupervisorIds.size,
      candidateCount: supervisors.length,
    },
  }
}

export async function rerunMatchingForStudent(
  prisma: PrismaClient,
  studentId: string
) {
  try {
    await generateRecommendationsForStudent(prisma, studentId)
    return { studentId, success: true as const }
  } catch (err: any) {
    return { studentId, success: false as const, error: err?.message || "Failed" }
  }
}

export async function rerunMatchingGlobally(prisma: PrismaClient) {
  const studentsWithProjects = await prisma.project.findMany({
    select: {
      studentId: true,
    },
  })

  const uniqueStudentIds = Array.from(
    new Set(studentsWithProjects.map((entry) => entry.studentId))
  )

  const results = await Promise.all(
    uniqueStudentIds.map((studentId) =>
      rerunMatchingForStudent(prisma, studentId)
    )
  )

  const recomputedStudents = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success)

  return {
    processedStudents: uniqueStudentIds.length,
    recomputedStudents,
    failedStudents: failed.length,
    failures: failed,
  }
}

export async function getMatchingEvaluationMetrics(prisma: PrismaClient) {
  const acceptedRequests = await prisma.supervisionRequest.findMany({
    where: {
      status: "accepted",
      respondedAt: {
        not: null,
      },
    },
    orderBy: {
      respondedAt: "desc",
    },
    select: {
      studentId: true,
      supervisorId: true,
      respondedAt: true,
    },
  })

  const latestAcceptedByStudent = new Map<string, string>()
  acceptedRequests.forEach((request) => {
    if (!latestAcceptedByStudent.has(request.studentId)) {
      latestAcceptedByStudent.set(request.studentId, request.supervisorId)
    }
  })

  const acceptedStudentIds = Array.from(latestAcceptedByStudent.keys())

  if (acceptedStudentIds.length === 0) {
    return {
      eligibleCount: 0,
      top1Hits: 0,
      top3Hits: 0,
      top1Accuracy: 0,
      top3Accuracy: 0,
    }
  }

  const recommendations = await prisma.matchRecommendation.findMany({
    where: {
      studentId: {
        in: acceptedStudentIds,
      },
    },
    orderBy: [{ studentId: "asc" }, { score: "desc" }],
    select: {
      studentId: true,
      supervisorId: true,
      score: true,
    },
  })

  const byStudent = new Map<string, Array<{ supervisorId: string; score: number }>>()
  recommendations.forEach((rec) => {
    const list = byStudent.get(rec.studentId) ?? []
    list.push({ supervisorId: rec.supervisorId, score: rec.score })
    byStudent.set(rec.studentId, list)
  })

  let eligibleCount = 0
  let top1Hits = 0
  let top3Hits = 0

  latestAcceptedByStudent.forEach((acceptedSupervisorId, studentId) => {
    const ranked = byStudent.get(studentId) ?? []
    if (ranked.length === 0) return

    const rank = ranked.findIndex((entry) => entry.supervisorId === acceptedSupervisorId)
    if (rank < 0) return

    eligibleCount += 1
    if (rank === 0) top1Hits += 1
    if (rank <= 2) top3Hits += 1
  })

  const top1Accuracy =
    eligibleCount > 0 ? Math.round((top1Hits / eligibleCount) * 100) : 0
  const top3Accuracy =
    eligibleCount > 0 ? Math.round((top3Hits / eligibleCount) * 100) : 0

  return {
    eligibleCount,
    top1Hits,
    top3Hits,
    top1Accuracy,
    top3Accuracy,
  }
}
