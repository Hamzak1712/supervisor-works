type MilestonePlanInput = {
  projectId: string
  title?: string | null
  description?: string | null
  keywords?: string | null
  startDate?: Date | null
}

type MilestoneSeed = {
  title: string
  description: string
  offsetDays: number
  isCriticalPath: boolean
}

const KEYWORD_BUCKETS: Array<{
  tag: string
  keywords: string[]
  milestoneTitle: string
  milestoneDescription: string
}> = [
  {
    tag: "ml",
    keywords: [
      "machine learning",
      "deep learning",
      "model",
      "nlp",
      "computer vision",
      "classification",
      "prediction",
    ],
    milestoneTitle: "Model Development and Validation",
    milestoneDescription:
      "Build, tune, and validate the core model pipeline with measurable metrics.",
  },
  {
    tag: "data",
    keywords: [
      "data",
      "analytics",
      "warehouse",
      "dashboard",
      "business intelligence",
      "visualization",
      "etl",
    ],
    milestoneTitle: "Data Pipeline and Analysis Build",
    milestoneDescription:
      "Implement data preparation, transformation, and analysis workflows aligned to project goals.",
  },
  {
    tag: "security",
    keywords: [
      "security",
      "cyber",
      "encryption",
      "forensics",
      "authentication",
      "authorization",
      "privacy",
    ],
    milestoneTitle: "Security Controls Implementation",
    milestoneDescription:
      "Implement core security controls and validate against identified threat scenarios.",
  },
  {
    tag: "mobile",
    keywords: ["mobile", "android", "ios", "flutter", "react native", "app"],
    milestoneTitle: "Mobile Prototype Build",
    milestoneDescription:
      "Develop the primary mobile workflows and validate usability with representative scenarios.",
  },
  {
    tag: "web",
    keywords: [
      "web",
      "frontend",
      "backend",
      "full stack",
      "api",
      "next.js",
      "react",
    ],
    milestoneTitle: "Core Web System Implementation",
    milestoneDescription:
      "Implement the main application workflows, data flow, and API integration.",
  },
  {
    tag: "iot",
    keywords: ["iot", "sensor", "embedded", "hardware", "arduino", "raspberry"],
    milestoneTitle: "Prototype Integration and Data Capture",
    milestoneDescription:
      "Integrate hardware/software components and validate reliable data capture and transfer.",
  },
]

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function pickBuildMilestone(
  title: string | null | undefined,
  description: string | null | undefined,
  keywords: string[]
) {
  const combined = normalizeText(
    [title || "", description || "", keywords.join(" ")].join(" ")
  )

  let bestMatch: (typeof KEYWORD_BUCKETS)[number] | null = null
  let bestScore = 0

  for (const bucket of KEYWORD_BUCKETS) {
    const score = bucket.keywords.reduce((sum, keyword) => {
      return combined.includes(normalizeText(keyword)) ? sum + 1 : sum
    }, 0)

    if (score > bestScore) {
      bestScore = score
      bestMatch = bucket
    }
  }

  if (!bestMatch) {
    return {
      title: "Prototype Implementation",
      description: "Build the first working version of the planned solution.",
    }
  }

  return {
    title: bestMatch.milestoneTitle,
    description: bestMatch.milestoneDescription,
  }
}

function buildMilestoneSeeds(input: {
  title?: string | null
  description?: string | null
  keywords?: string | null
}) {
  const keywordList = splitCsv(input.keywords)
  const buildMilestone = pickBuildMilestone(
    input.title,
    input.description,
    keywordList
  )

  const projectName = input.title?.trim() || "Project"

  const seeds: MilestoneSeed[] = [
    {
      title: "Project Scope and Problem Definition",
      description: `Define scope, research question, and success criteria for ${projectName}.`,
      offsetDays: 7,
      isCriticalPath: false,
    },
    {
      title: "Literature Review and Background Study",
      description:
        "Review key academic and technical sources to justify the proposed approach.",
      offsetDays: 21,
      isCriticalPath: false,
    },
    {
      title: "Requirements and Evaluation Plan",
      description:
        "Finalize functional/non-functional requirements and measurable evaluation criteria.",
      offsetDays: 35,
      isCriticalPath: false,
    },
    {
      title: "System Architecture and Design",
      description:
        "Design architecture, data flow, and implementation structure for the proposed solution.",
      offsetDays: 49,
      isCriticalPath: false,
    },
    {
      title: buildMilestone.title,
      description: buildMilestone.description,
      offsetDays: 70,
      isCriticalPath: false,
    },
    {
      title: "Interim Progress Demonstration (IPD)",
      description:
        "Prepare and submit the interim deliverables, including demo material and progress evidence.",
      offsetDays: 84,
      isCriticalPath: true,
    },
    {
      title: "Testing, Evaluation, and Refinement",
      description:
        "Execute testing plan, evaluate outcomes, and apply final refinements to the solution.",
      offsetDays: 105,
      isCriticalPath: false,
    },
    {
      title: "Final Report Submission",
      description:
        "Complete dissertation documentation with methodology, results, and critical discussion.",
      offsetDays: 119,
      isCriticalPath: true,
    },
    {
      title: "Final Viva Preparation",
      description:
        "Prepare final presentation, live demonstration, and viva responses.",
      offsetDays: 126,
      isCriticalPath: true,
    },
  ]

  return seeds
}

export function generateInitialMilestonePlan(input: MilestonePlanInput) {
  const startDate = input.startDate ?? new Date()
  const seeds = buildMilestoneSeeds({
    title: input.title,
    description: input.description,
    keywords: input.keywords,
  })

  return seeds.map((seed) => ({
    projectId: input.projectId,
    title: seed.title,
    description: seed.description,
    dueDate: addDays(startDate, seed.offsetDays),
    status: "pending",
    isCriticalPath: seed.isCriticalPath,
  }))
}
