"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Mail,
  Edit3,
  Send,
  ArrowRight,
  Lock,
  BookOpen,
  Target,
  Save,
  X,
  Pencil,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { ProjectCard } from "@/components/student/ProjectCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { User } from "@/types"

type ProjectApi = {
  id: string | null
  studentId: string | null
  title: string | null
  description: string | null
  keywords: string | null
  status: string | null
  createdAt: string | null
  updatedAt: string | null
}

type SupervisorApi = {
  id: string
  email: string
  fullName: string | null
  name?: string | null
  expertise: string | null
  maxCapacity: number | null
} | null

type ApiMilestone = {
  id: string
  projectId: string
  title: string
  description: string | null
  dueDate: string
  status: "pending" | "in_progress" | "completed" | "delayed" | string
  isCriticalPath: boolean
}

type LatestRequestApi = {
  id: string
  supervisorId: string
  supervisorName: string | null
  supervisorEmail: string
  status: "pending" | "accepted" | "declined" | string
  createdAt: string
  respondedAt: string | null
} | null

type ProjectCardStatus = "active" | "draft" | "pending_supervisor" | "completed"

type ProjectCardProject = {
  id: string
  studentId: string
  title: string
  abstract: string
  description: string
  keywords: string[]
  expertiseTags: string[]
  status: ProjectCardStatus
  createdAt: string
  updatedAt: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

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

function normalizeProjectStatus(status: string | null | undefined): ProjectCardStatus {
  if (
    status === "active" ||
    status === "draft" ||
    status === "pending_supervisor" ||
    status === "completed"
  ) {
    return status
  }

  return "draft"
}

function splitCsv(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

const fallbackShellUser: User = {
  id: "student",
  email: "student@example.com",
  name: "Student",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

export default function StudentProjectPage() {
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState("")
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)

  const [project, setProject] = useState<ProjectApi | null>(null)
  const [supervisor, setSupervisor] = useState<SupervisorApi>(null)
  const [latestRequest, setLatestRequest] = useState<LatestRequestApi>(null)
  const [milestones, setMilestones] = useState<ApiMilestone[]>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [keywords, setKeywords] = useState("")
  const [status, setStatus] = useState("draft")

  const fetchProjectAndProfile = useCallback(
    async (options?: { silent?: boolean; syncEditorFields?: boolean }) => {
      try {
        if (!options?.silent) {
          setError("")
        }
        const token = localStorage.getItem("token")

        const [projectRes, profileRes, meRes] = await Promise.all([
          fetch("/api/student/project", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/student/profile", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const projectData = await projectRes.json()
        const profileData = await profileRes.json()
        const meData = await meRes.json()

        if (!projectRes.ok) {
          throw new Error(projectData?.error || "Failed to load project")
        }

        if (!profileRes.ok) {
          throw new Error(profileData?.error || "Failed to load profile")
        }

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load current user")
        }

        const meUser = meData?.user
        const studentName =
          meUser?.studentProfile?.fullName ||
          meUser?.email?.split("@")?.[0] ||
          "Student"

        setShellUser({
          id: meUser?.id || fallbackShellUser.id,
          email: meUser?.email || fallbackShellUser.email,
          name: studentName,
          role: "student",
          avatarUrl: "/placeholder.svg",
          createdAt:
            typeof meUser?.createdAt === "string"
              ? meUser.createdAt
              : fallbackShellUser.createdAt,
        })

        const dbProject: ProjectApi = projectData.project
        setProject(dbProject)
        const shouldSyncEditorFields =
          typeof options?.syncEditorFields === "boolean"
            ? options.syncEditorFields
            : !isEditing

        if (shouldSyncEditorFields) {
          setTitle(dbProject?.title || "")
          setDescription(dbProject?.description || "")
          setKeywords(dbProject?.keywords || "")
          setStatus(dbProject?.status || "draft")
        }

        setSupervisor(profileData.supervisor || null)
        setLatestRequest(profileData.latestRequest || null)

        if (dbProject?.id) {
          const timelineRes = await fetch("/api/student/timeline", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          const timelineData = await timelineRes.json()

          if (!timelineRes.ok) {
            throw new Error(timelineData?.error || "Failed to load timeline")
          }

          setMilestones(timelineData.milestones || [])
        } else {
          setMilestones([])
        }
        setError("")
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load your project from the database.")
      } finally {
        setLoading(false)
      }
    },
    [isEditing]
  )

  useEffect(() => {
    function refreshOnVisible() {
      if (document.visibilityState === "visible") {
        void fetchProjectAndProfile({
          silent: true,
          syncEditorFields: !isEditing,
        })
      }
    }

    void fetchProjectAndProfile()
    const interval = window.setInterval(() => {
      void fetchProjectAndProfile({
        silent: true,
        syncEditorFields: !isEditing,
      })
    }, 10000)

    window.addEventListener("focus", refreshOnVisible)
    document.addEventListener("visibilitychange", refreshOnVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshOnVisible)
      document.removeEventListener("visibilitychange", refreshOnVisible)
    }
  }, [fetchProjectAndProfile, isEditing])

  const handleSave = async () => {
    try {
      setError("")
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/project", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          keywords,
          status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save project")
      }

      setProject(data.project)
      setStatus(data.project?.status || "draft")
      setIsEditing(false)
      setJustSaved(true)
      setError("")
      window.setTimeout(() => setJustSaved(false), 2200)
      void fetchProjectAndProfile({ silent: true })
    } catch (err) {
      console.error(err)
      setError("Could not save your project changes.")
    }
  }

  const currentProject: ProjectCardProject | null =
    title || description || keywords
      ? {
          id: project?.id || "db-project",
          studentId: project?.studentId || shellUser.id,
          title: title || "Untitled Project",
          abstract: description || "No project abstract yet.",
          description: description || "No project description yet.",
          keywords: keywords
            ? keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
          expertiseTags: keywords
            ? keywords.split(",").map((k) => k.trim()).filter(Boolean)
            : [],
          status: normalizeProjectStatus(status),
          createdAt: project?.createdAt || new Date().toISOString(),
          updatedAt: project?.updatedAt || new Date().toISOString(),
        }
      : null

  const completed = milestones.filter((m) => m.status === "completed").length
  const inProgress = milestones.filter((m) => m.status === "in_progress").length
  const delayed = milestones.filter((m) => m.status === "delayed").length
  const total = milestones.length
  const progress = total ? Math.round((completed / total) * 100) : 0

  const sortedUpcoming = milestones
    .filter((m) => m.status !== "completed")
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )

  const nextMilestone = sortedUpcoming[0]
  const finalMilestone = milestones.find((m) =>
    m.title.toLowerCase().includes("final viva")
  )

  const today = new Date()
  const daysToFinal = finalMilestone
    ? daysBetween(new Date(finalMilestone.dueDate), today)
    : null

  const stats = [
    {
      label: "Overall Progress",
      value: `${progress}%`,
      hint: `${completed}/${total} milestones`,
      icon: TrendingUp,
      tone: "primary" as const,
    },
    {
      label: "In Progress",
      value: inProgress,
      hint: "Active milestones",
      icon: Clock,
      tone: "chart-2" as const,
    },
    {
      label: "Days to Viva",
      value: daysToFinal !== null ? Math.max(daysToFinal, 0) : "—",
      hint: finalMilestone ? formatDate(finalMilestone.dueDate) : "Not scheduled",
      icon: Calendar,
      tone: "warning" as const,
    },
    {
      label: "Delayed",
      value: delayed,
      hint: delayed > 0 ? "Needs attention" : "Nothing overdue",
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
      <DashboardShell user={shellUser} role="student" title="My Project">
        <div className="p-6">Loading project...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="student" title="My Project">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        {currentProject && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              const tone = toneStyles[stat.tone]
              return (
                <Card
                  key={stat.label}
                  className="transition-colors hover:border-primary/40"
                >
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold tabular-nums leading-none">
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stat.hint}
                      </p>
                    </div>
                    <div className={`rounded-xl p-2.5 ${tone.bg}`}>
                      <Icon className={`h-5 w-5 ${tone.fg}`} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {currentProject ? (
              <ProjectCard project={currentProject} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-4 w-4 text-primary" />
                    Start Your Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  You have not saved a project yet. Use the editor below to create one.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Edit3 className="h-4 w-4 text-primary" />
                    Project Editor
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    This section is now connected to your real database.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {justSaved && (
                    <span className="flex items-center gap-1 text-sm text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </span>
                  )}

                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        <Save className="mr-1 h-4 w-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit Project
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-title">Project Title</Label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your project title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-keywords">Keywords</Label>
                  <Input
                    id="project-keywords"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. AI, NLP, scheduling, recommender systems"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate keywords with commas.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Project Description</Label>
                  <Textarea
                    id="project-description"
                    rows={8}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isEditing}
                    placeholder="Describe your project idea, aims, and what you want to build."
                  />
                </div>
              </CardContent>
            </Card>

            {currentProject && total > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                      Milestone Progress
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Your next few checkpoints
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/student/project-timeline">
                      Full timeline
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Overall completion
                      </span>
                      <span className="font-medium tabular-nums">
                        {progress}%
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {sortedUpcoming.slice(0, 4).map((milestone) => {
                      const daysLeft = daysBetween(
                        new Date(milestone.dueDate),
                        today
                      )
                      const isOverdue = daysLeft < 0
                      const isSoon = daysLeft >= 0 && daysLeft <= 14

                      return (
                        <div
                          key={milestone.id}
                          className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40"
                        >
                          <div
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              milestone.status === "in_progress"
                                ? "bg-primary"
                                : milestone.status === "delayed"
                                  ? "bg-destructive"
                                  : "bg-muted-foreground/40"
                            }`}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium leading-tight">
                                {milestone.title}
                              </p>
                              {milestone.isCriticalPath && (
                                <Badge
                                  variant="outline"
                                  className="h-5 gap-1 border-warning/30 text-[10px] text-warning"
                                >
                                  <Lock className="h-2.5 w-2.5" />
                                  Critical
                                </Badge>
                              )}
                            </div>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {milestone.description}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-medium">
                              {formatDate(milestone.dueDate)}
                            </p>
                            <p
                              className={`text-[10px] ${
                                isOverdue
                                  ? "text-destructive"
                                  : isSoon
                                    ? "text-warning"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {isOverdue
                                ? `${Math.abs(daysLeft)} days overdue`
                                : `${daysLeft} days left`}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {supervisor ? (
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Your Supervisor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src="/placeholder.svg"
                        alt={supervisor.fullName || "Supervisor"}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(supervisor.fullName || "Supervisor")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold leading-tight">
                        {supervisor.fullName || "Assigned Supervisor"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        School of Computing
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {supervisor.email}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Expertise
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {splitCsv(supervisor.expertise).slice(0, 4).map((item) => (
                        <Badge
                          key={item}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button asChild size="sm">
                      <Link
                        href={`/dashboard/messages?userId=${supervisor.id}&name=${encodeURIComponent(
                          supervisor.fullName || supervisor.name || "Supervisor"
                        )}`}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Message Supervisor
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href={`/dashboard/meetings?userId=${supervisor.id}&name=${encodeURIComponent(
                          supervisor.fullName || supervisor.name || "Supervisor"
                        )}`}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Meeting
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Find a Supervisor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestRequest && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">
                        Latest request:{" "}
                        <span className="capitalize">{latestRequest.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {latestRequest.supervisorName || "Supervisor"} ·{" "}
                        {latestRequest.supervisorEmail}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    You don&apos;t have a supervisor yet. Get matched using AI
                    recommendations.
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link href="/dashboard/student/find-supervisor">
                      <Send className="mr-2 h-4 w-4" />
                      {latestRequest?.status === "declined"
                        ? "Find Another Supervisor"
                        : "Find Supervisor"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Update Project Details
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Link href="/dashboard/student/project-timeline">
                    <Calendar className="mr-2 h-4 w-4" />
                    View Full Timeline
                  </Link>
                </Button>
                {nextMilestone && !nextMilestone.isCriticalPath && (
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark Milestone Complete
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Project Guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="leading-relaxed">
                    Keep your abstract clear and concise — it drives the quality
                    of AI matching.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="leading-relaxed">
                    Update your milestones weekly so your supervisor can leave
                    timely feedback.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="leading-relaxed">
                    Critical path items (PPRS, IPD, Final Viva) are locked by
                    the university.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
