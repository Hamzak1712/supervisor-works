"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, CheckCircle2, Send, User } from "lucide-react"

type GuidedQuestion = {
  id: string
  question: string
  placeholder: string
}

type GuidedResponse = {
  id: string
  question: string
  answer: string
}

const fallbackQuestions: GuidedQuestion[] = [
  {
    id: "supervisionDomains",
    question: "Which topic areas can you supervise confidently?",
    placeholder: "Example: AI, data science, cybersecurity, web systems",
  },
  {
    id: "preferredProjectType",
    question: "What project style do you supervise best?",
    placeholder: "Example: practical build, research-heavy, or hybrid",
  },
  {
    id: "coreTechnologies",
    question: "Which technologies and methods are your strongest?",
    placeholder: "Example: Python, React, cloud systems, model evaluation",
  },
  {
    id: "studentSupportStrengths",
    question: "What student goals do you best support?",
    placeholder: "Example: applied product development, dissertation writing, experimentation",
  },
  {
    id: "supervisionStyle",
    question: "How would you describe your supervision style and expectations?",
    placeholder: "Example: weekly progress check-ins with concise action points",
  },
  {
    id: "pastProjectThemes",
    question: "What project themes have you supervised before?",
    placeholder: "Example: recommendation systems, secure backend APIs, IoT dashboards",
  },
]

function toResponseMap(responses: GuidedResponse[] | undefined) {
  if (!responses || responses.length === 0) return {}

  return responses.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = typeof item.answer === "string" ? item.answer : ""
    return acc
  }, {})
}

function firstUnansweredIndex(questions: GuidedQuestion[], values: Record<string, string>) {
  const index = questions.findIndex((question) => !(values[question.id] || "").trim())
  if (index === -1) return questions.length - 1
  return index
}

export default function SupervisorOnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [questions, setQuestions] = useState<GuidedQuestion[]>(fallbackQuestions)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState("")

  const currentQuestion = questions[currentIndex]

  const answeredCount = useMemo(() => {
    return questions.filter((question) => (responses[question.id] || "").trim()).length
  }, [questions, responses])

  const allAnswered = answeredCount === questions.length && questions.length > 0

  async function loadOnboardingState() {
    try {
      setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const res = await fetch("/api/supervisor/onboarding", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load onboarding")
      }

      if (data?.onboardingCompleted) {
        router.replace("/dashboard/supervisor")
        return
      }

      const incomingQuestions: GuidedQuestion[] =
        Array.isArray(data?.questions) && data.questions.length > 0
          ? data.questions
          : fallbackQuestions

      const responseMap = toResponseMap(
        Array.isArray(data?.responses) ? (data.responses as GuidedResponse[]) : []
      )

      const nextIndex = firstUnansweredIndex(incomingQuestions, responseMap)
      const activeQuestion = incomingQuestions[Math.max(0, nextIndex)]

      setQuestions(incomingQuestions)
      setResponses(responseMap)
      setCurrentIndex(Math.max(0, nextIndex))
      setDraft(activeQuestion ? responseMap[activeQuestion.id] || "" : "")
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load onboarding.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOnboardingState()
  }, [])

  function goToStep(stepIndex: number, mapOverride?: Record<string, string>) {
    const clamped = Math.max(0, Math.min(stepIndex, questions.length - 1))
    const source = mapOverride || responses
    const questionId = questions[clamped]?.id
    setCurrentIndex(clamped)
    setDraft(questionId ? source[questionId] || "" : "")
  }

  function handleSaveAnswer() {
    if (!currentQuestion) return

    if (!draft.trim()) {
      setError("Please type an answer before continuing.")
      return
    }

    const nextResponses = {
      ...responses,
      [currentQuestion.id]: draft.trim(),
    }

    setResponses(nextResponses)
    setError("")

    if (currentIndex < questions.length - 1) {
      goToStep(currentIndex + 1, nextResponses)
      return
    }

    setDraft(nextResponses[currentQuestion.id] || "")
  }

  function handleBack() {
    if (currentIndex === 0) return
    setError("")
    goToStep(currentIndex - 1)
  }

  async function handleFinish() {
    if (!allAnswered) {
      setError("Please answer all questions before finishing.")
      return
    }

    try {
      setSaving(true)
      setError("")

      const token = localStorage.getItem("token")
      const payload: GuidedResponse[] = questions.map((question) => ({
        id: question.id,
        question: question.question,
        answer: responses[question.id] || "",
      }))

      const res = await fetch("/api/supervisor/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responses: payload }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to complete onboarding")
      }

      router.replace("/dashboard/supervisor")
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not finish onboarding.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading onboarding...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-card p-5 shadow-sm md:p-8">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Supervisor AI onboarding conversation</p>
          <h1 className="mt-1 text-2xl font-bold">Set your supervision profile for matching</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your answers are converted into structured matching signals so students see better aligned recommendations.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Progress: {answeredCount}/{questions.length} answered
          </p>
        </div>

        <div className="mb-5 max-h-[420px] space-y-4 overflow-y-auto rounded-xl border bg-muted/20 p-4">
          {questions.slice(0, currentIndex + 1).map((question) => {
            const answer = responses[question.id]

            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-1 rounded-full bg-primary/15 p-1.5 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-background px-3 py-2 text-sm">
                    {question.question}
                  </div>
                </div>

                {answer?.trim() ? (
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {answer}
                    </div>
                    <div className="mt-1 rounded-full bg-primary p-1.5 text-primary-foreground">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Current question</p>
          <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            {currentQuestion?.question}
          </p>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={currentQuestion?.placeholder || "Type your answer"}
            className="min-h-[120px] w-full resize-none rounded-xl border bg-background p-4 outline-none"
          />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0 || saving}
            className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
          >
            Back
          </button>

          <button
            onClick={handleSaveAnswer}
            disabled={saving || !draft.trim()}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            <Send className="mr-2 h-4 w-4" />
            Save answer
          </button>

          <button
            onClick={handleFinish}
            disabled={saving || !allAnswered}
            className="inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {saving ? "Finishing..." : "Finish onboarding"}
          </button>
        </div>
      </div>
    </div>
  )
}
