"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Calendar,
  Target,
  TrendingUp,
  Hourglass,
  Plus,
  RefreshCcw,
  Save,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { GanttChart } from "@/components/student/GanttChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { currentStudent } from "@/lib/mock-data"
import type { Milestone } from "@/types"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

type ApiMilestone = {
  id: string
  projectId: string
  title: string
  description: string | null
  dueDate: string
  status: string
  isCriticalPath: boolean
  feedback: string | null
  completedDate: string | null
  createdAt: string
  updatedAt: string
}

function normalizeStatus(
  status: string
): "pending" | "in_progress" | "completed" | "delayed" {
  if (
    status === "pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "delayed"
  ) {
    return status
  }
  return "pending"
}

function mapApiMilestoneToMilestone(m: ApiMilestone): Milestone {
  return {
    id: m.id,
    projectId: m.projectId,
    title: m.title,
    description: m.description || "",
    dueDate: m.dueDate,
    status: normalizeStatus(m.status),
    isCriticalPath: m.isCriticalPath,
    feedback: m.feedback || undefined,
    completedDate: m.completedDate || undefined,
  }
}

export default function StudentProjectTimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [creating, setCreating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [aiAdvice, setAiAdvice] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")

  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newDueDate, setNewDueDate] = useState("")
  const [newStatus, setNewStatus] =
    useState<Milestone["status"]>("pending")
  const [newIsCriticalPath, setNewIsCriticalPath] = useState(false)

  useEffect(() => {
    fetchTimeline()
  }, [])

  async function fetchTimeline() {
    try {
      setError("")
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/timeline", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load timeline")
      }

      const apiMilestones: ApiMilestone[] = data.milestones || []
      setMilestones(apiMilestones.map(mapApiMilestoneToMilestone))
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load timeline.")
    } finally {
      setLoading(false)
    }
  }

  const getAiAdvice = async () => {
    try {
      setAiLoading(true)
      setError("")
      setAiError("")
      setAiAdvice("")

      const token = localStorage.getItem("token")

      const res = await fetch("/api/ai/timeline-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ milestones }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "AI failed")
      }

      setAiAdvice(data.suggestion || "")
    } catch (err: any) {
      console.error(err)
      setAiError(err?.message || "AI failed to generate advice.")
    } finally {
      setAiLoading(false)
    }
  }

  const handleUpdateStatus = async (
    id: string,
    status: Milestone["status"]
  ) => {
    try {
      setError("")
      setNotice("")
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/timeline", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          milestoneId: id,
          status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update milestone")
      }

      if (status === "delayed") {
        const applied = data?.recalculation?.shiftDaysApplied
        const moved = data?.rescheduledCount || 0
        const warnings = Array.isArray(data?.recalculation?.warnings)
          ? data.recalculation.warnings
          : []

        const parts: string[] = []
        if (typeof applied === "number") {
          parts.push(`Reschedule applied with a ${applied}-day delay.`)
        }
        if (moved > 0) {
          parts.push(`${moved} downstream milestones were recalculated.`)
        }
        if (warnings.length > 0) {
          parts.push(warnings[0])
        }

        if (parts.length > 0) {
          setNotice(parts.join(" "))
        }
      }

      await fetchTimeline()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update milestone.")
    }
  }

  const handleCreateMilestone = async () => {
    try {
      setError("")

      if (!newTitle.trim()) {
        setError("Please enter a milestone title.")
        return
      }

      if (!newDueDate) {
        setError("Please choose a due date.")
        return
      }

      setCreating(true)
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          dueDate: newDueDate,
          status: newStatus,
          isCriticalPath: newIsCriticalPath,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create milestone")
      }

      const createdMilestone = mapApiMilestoneToMilestone(data.milestone)
      setMilestones((prev) =>
        [...prev, createdMilestone].sort(
          (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        )
      )

      setNewTitle("")
      setNewDescription("")
      setNewDueDate("")
      setNewStatus("pending")
      setNewIsCriticalPath(false)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not create milestone.")
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerateInitialPlan = async () => {
    const confirmed = window.confirm(
      "Regenerate the initial plan? This keeps completed and in-progress milestones, and refreshes pending/delayed milestones from your current project idea."
    )

    if (!confirmed) return

    try {
      setError("")
      setNotice("")
      setRegenerating(true)
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/timeline", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "regenerate_initial_plan",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to regenerate plan")
      }

      const createdCount = data?.regeneration?.createdCount ?? 0
      const replacedCount = data?.regeneration?.replacedCount ?? 0
      const preservedCount = data?.regeneration?.preservedCount ?? 0

      setNotice(
        `Plan regenerated safely: created ${createdCount}, replaced ${replacedCount}, preserved ${preservedCount} milestones.`
      )

      await fetchTimeline()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not regenerate the initial plan.")
    } finally {
      setRegenerating(false)
    }
  }

  const completed = useMemo(
    () => milestones.filter((m) => m.status === "completed").length,
    [milestones]
  )
  const inProgress = useMemo(
    () => milestones.filter((m) => m.status === "in_progress").length,
    [milestones]
  )
  const pending = useMemo(
    () => milestones.filter((m) => m.status === "pending").length,
    [milestones]
  )
  const delayed = useMemo(
    () => milestones.filter((m) => m.status === "delayed").length,
    [milestones]
  )
  const total = milestones.length
  const progress = total ? Math.round((completed / total) * 100) : 0

  const today = new Date()

  const upcoming = useMemo(
    () =>
      [...milestones]
        .filter((m) => m.status !== "completed")
        .sort(
          (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        ),
    [milestones]
  )

  const nextMilestone = upcoming[0]
  const criticalPath = useMemo(
    () => milestones.filter((m) => m.isCriticalPath),
    [milestones]
  )

  const stats = [
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      tone: "success" as const,
    },
    {
      label: "In Progress",
      value: inProgress,
      icon: Clock,
      tone: "primary" as const,
    },
    {
      label: "Pending",
      value: pending,
      icon: Hourglass,
      tone: "chart-2" as const,
    },
    {
      label: "Delayed",
      value: delayed,
      icon: AlertTriangle,
      tone: delayed > 0 ? ("destructive" as const) : ("success" as const),
    },
  ]

  const toneStyles = {
    primary: { bg: "bg-primary/10", fg: "text-primary" },
    warning: { bg: "bg-warning/10", fg: "text-warning" },
    success: { bg: "bg-success/10", fg: "text-success" },
    destructive: { bg: "bg-destructive/10", fg: "text-destructive" },
    "chart-2": { bg: "bg-chart-2/10", fg: "text-chart-2" },
  } as const

  if (loading) {
    return (
      <DashboardShell
        user={currentStudent}
        role="student"
        title="Project Timeline"
      >
        <div className="p-6">Loading timeline...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      user={currentStudent}
      role="student"
      title="Project Timeline"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">
              {error}
            </CardContent>
          </Card>
        )}

        {notice && (
          <Card className="border-blue-500/30">
            <CardContent className="p-4 text-sm text-blue-600">
              {notice}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            const tone = toneStyles[stat.tone]
            return (
              <Card
                key={stat.label}
                className="transition-colors hover:border-primary/40"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`rounded-xl p-2.5 ${tone.bg}`}>
                    <Icon className={`h-5 w-5 ${tone.fg}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Overall Completion
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{progress}%</p>
                </div>
              </div>
              <div className="min-w-[200px] flex-1">
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {completed} of {total} milestones completed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-4 w-4 text-primary" />
              Add Milestone
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create real milestones for your project timeline
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">
                Need to refresh milestones after changing your project idea?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateInitialPlan}
                disabled={regenerating}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {regenerating ? "Regenerating..." : "Regenerate Initial Plan"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <LabelText>Title</LabelText>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Literature Review"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <LabelText>Description</LabelText>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe this milestone"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <LabelText>Due Date</LabelText>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <LabelText>Status</LabelText>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as Milestone["status"])
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="critical-path"
                type="checkbox"
                checked={newIsCriticalPath}
                onChange={(e) => setNewIsCriticalPath(e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="critical-path"
                className="text-sm text-muted-foreground"
              >
                Mark as critical path
              </label>
            </div>

            <Button onClick={handleCreateMilestone} disabled={creating}>
              <Save className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Create Milestone"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <GanttChart
              milestones={milestones}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>

          <div className="space-y-6">
            {nextMilestone && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">
                      Next Up
                    </p>
                  </div>
                  <CardTitle className="text-pretty text-lg leading-tight">
                    {nextMilestone.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {nextMilestone.description}
                  </p>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Due date</span>
                      <span className="font-medium">
                        {formatDate(nextMilestone.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Time left</span>
                      <span className="font-medium tabular-nums">
                        {(() => {
                          const d = daysBetween(
                            new Date(nextMilestone.dueDate),
                            today
                          )
                          return d < 0
                            ? `${Math.abs(d)} days overdue`
                            : `${d} days`
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      {nextMilestone.isCriticalPath ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-warning/30 text-warning"
                        >
                          <Lock className="h-3 w-3" />
                          Critical path
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Flexible</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lock className="h-4 w-4 text-warning" />
                  Critical Deadlines
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Locked by the university — cannot be moved
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {criticalPath.map((m) => {
                  const isDone = m.status === "completed"
                  return (
                    <div
                      key={m.id}
                      className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          isDone ? "bg-success/10" : "bg-warning/10"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Lock className="h-3 w-3 text-warning" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(m.dueDate)}
                        </p>
                      </div>
                      {isDone && (
                        <Badge
                          variant="secondary"
                          className="bg-success/10 text-success"
                        >
                          Done
                        </Badge>
                      )}
                    </div>
                  )
                })}
                {criticalPath.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No critical milestones yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-4 w-4 text-primary" />
                  Timeline Guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="leading-relaxed">
                  Your timeline now loads milestones from the real database.
                </p>
                <p className="leading-relaxed">
                  Flexible milestones can be updated by status, while critical ones
                  remain locked by the university.
                </p>
                <p className="leading-relaxed">
                  Delayed milestones now trigger dependency-aware downstream recalculation with critical deadline protection.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Project Advice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={getAiAdvice} disabled={aiLoading}>
                  {aiLoading ? "Generating..." : "Get AI Project Advice"}
                </Button>

                {aiError && (
                  <p className="text-sm text-destructive">{aiError}</p>
                )}

                {aiAdvice && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {aiAdvice}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>
}
