"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  GraduationCap,
  MessageCircle,
  Plus,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })
}

function daysUntil(iso: string) {
  const now = new Date()
  const target = new Date(iso)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

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

type StudentProfileApi = {
  fullName: string | null
  skills: string | null
  interests: string | null
  supervisorId: string | null
}

type SupervisorApi = {
  id: string
  email: string
  fullName: string | null
  expertise: string | null
  maxCapacity: number | null
} | null

type LatestRequestApi = {
  id: string
  supervisorId: string
  supervisorName: string | null
  supervisorEmail: string
  status: "pending" | "accepted" | "declined" | string
  createdAt: string
  respondedAt: string | null
} | null

type ApiMilestone = {
  id: string
  projectId: string
  title: string
  description: string | null
  dueDate: string
  status: string
  isCriticalPath: boolean
  createdAt: string
  updatedAt: string
}

type DashboardProject = {
  id: string
  studentId: string
  title: string
  abstract: string
  keywords: string[]
  status: string
  createdAt: string
  updatedAt: string
}

type DashboardMilestone = {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string
  status: "pending" | "in_progress" | "completed" | "delayed"
  isCriticalPath: boolean
}

function normalizeMilestoneStatus(
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

const fallbackShellUser: User = {
  id: "student",
  email: "student@example.com",
  name: "Student",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [project, setProject] = useState<DashboardProject | null>(null)
  const [profile, setProfile] = useState<StudentProfileApi | null>(null)
  const [supervisor, setSupervisor] = useState<SupervisorApi>(null)
  const [latestRequest, setLatestRequest] = useState<LatestRequestApi>(null)
  const [milestones, setMilestones] = useState<DashboardMilestone[]>([])

  const fetchDashboardData = useCallback(
    async (options?: { silent?: boolean }) => {
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

        const mappedProject =
          dbProject?.id ||
          dbProject?.title ||
          dbProject?.description ||
          dbProject?.keywords
            ? {
                id: dbProject.id || "db-project",
                studentId: dbProject.studentId || meUser.id,
                title: dbProject.title || "Untitled Project",
                abstract: dbProject.description || "No project description yet.",
                keywords: splitCsv(dbProject.keywords),
                status: dbProject.status || "draft",
                createdAt: dbProject.createdAt || new Date().toISOString(),
                updatedAt: dbProject.updatedAt || new Date().toISOString(),
              }
            : null

        let mappedMilestones: DashboardMilestone[] = []
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

          const apiMilestones: ApiMilestone[] = timelineData.milestones || []
          mappedMilestones = apiMilestones.map((m) => ({
            id: m.id,
            projectId: m.projectId,
            title: m.title,
            description: m.description || "",
            dueDate: m.dueDate,
            status: normalizeMilestoneStatus(m.status),
            isCriticalPath: m.isCriticalPath,
          }))
        }

        setProject(mappedProject)
        setProfile(profileData.profile || null)
        setSupervisor(profileData.supervisor || null)
        setLatestRequest(profileData.latestRequest || null)
        setMilestones(mappedMilestones)
        setError("")
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load your dashboard data.")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    function refreshOnVisible() {
      if (document.visibilityState === "visible") {
        void fetchDashboardData({ silent: true })
      }
    }

    void fetchDashboardData()
    const interval = window.setInterval(() => {
      void fetchDashboardData({ silent: true })
    }, 10000)

    window.addEventListener("focus", refreshOnVisible)
    document.addEventListener("visibilitychange", refreshOnVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshOnVisible)
      document.removeEventListener("visibilitychange", refreshOnVisible)
    }
  }, [fetchDashboardData])

  const completed = milestones.filter((m) => m.status === "completed").length
  const inProgress = milestones.filter((m) => m.status === "in_progress").length
  const remaining = milestones.length - completed
  const progress = milestones.length
    ? Math.round((completed / milestones.length) * 100)
    : 0

  const upcomingMilestones = useMemo(() => {
    return [...milestones]
      .filter((m) => m.status !== "completed")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [milestones])

  const nextMilestone = upcomingMilestones[0]
  const nextDeadlineDays = nextMilestone ? daysUntil(nextMilestone.dueDate) : null

  const recentActivity = [
    {
      id: "act-1",
      icon: CheckCircle2,
      title:
        completed > 0
          ? `${completed} milestone${completed === 1 ? "" : "s"} completed so far`
          : "No completed milestones yet",
      meta: project ? "Live project data" : "Waiting for project setup",
      tone: "success" as const,
    },
    {
      id: "act-2",
      icon: MessageCircle,
      title: `Supervisor status: ${
        supervisor?.fullName ? `assigned to ${supervisor.fullName}` : "not assigned yet"
      }`,
      meta: supervisor ? supervisor.email : "Use AI matching to find one",
      tone: "primary" as const,
    },
    {
      id: "act-3",
      icon: FileText,
      title: project ? `Project saved: ${project.title}` : "No project saved yet",
      meta: project ? `${project.keywords.length} keyword(s) added` : "Create your project to begin",
      tone: "chart" as const,
    },
  ]

  if (loading) {
    return (
      <DashboardShell user={shellUser} role="student" title="Student Dashboard">
        <div className="p-6">Loading dashboard...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="student" title="Student Dashboard">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 md:flex">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-background/50 text-primary"
                >
                  {profile?.fullName || shellUser.name}
                </Badge>
                <h1 className="text-2xl font-bold leading-tight text-balance md:text-3xl">
                  Welcome back, {shellUser.name.split(" ")[0]}
                </h1>
                <p className="max-w-xl text-sm text-muted-foreground text-pretty">
                  {project
                    ? `You're ${progress}% of the way through "${project.title}". ${
                        nextMilestone
                          ? `Your next milestone is due in ${nextDeadlineDays} day${
                              nextDeadlineDays === 1 ? "" : "s"
                            }.`
                          : "Keep the momentum going."
                      }`
                    : "Start by defining your project and finding a supervisor who matches your interests."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {project ? (
                <Button asChild>
                  <Link href="/dashboard/student/project">
                    <FileText className="mr-2 h-4 w-4" />
                    Open project
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/dashboard/student/project">
                    <Plus className="mr-2 h-4 w-4" />
                    Create project
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/dashboard/student/project-timeline">
                  <Calendar className="mr-2 h-4 w-4" />
                  Timeline
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {progress >= 50 ? "On track" : "Getting started"}
                </Badge>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight">{progress}%</p>
              <p className="text-sm text-muted-foreground">Project progress</p>
              <Progress value={progress} className="mt-3 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {inProgress} in progress
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight">
                {completed}
                <span className="text-lg font-medium text-muted-foreground">
                  /{milestones.length || 0}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">Milestones complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                {nextMilestone?.isCriticalPath ? (
                  <Badge
                    variant="outline"
                    className="border-warning/40 text-xs text-warning"
                  >
                    Critical
                  </Badge>
                ) : null}
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight">
                {nextMilestone ? formatShortDate(nextMilestone.dueDate) : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {nextMilestone
                  ? `In ${nextDeadlineDays} day${nextDeadlineDays === 1 ? "" : "s"}`
                  : "No deadlines scheduled"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                  <Users className="h-5 w-5 text-chart-2" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {supervisor ? "Active" : "Not assigned"}
                </Badge>
              </div>
              <p className="mt-4 truncate text-lg font-bold">
                {supervisor ? supervisor.fullName || "Assigned Supervisor" : "Find supervisor"}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {supervisor ? supervisor.email : "AI-powered matching available"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg">Your project</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project ? "Active dissertation" : "Set up your project to get started"}
                  </p>
                </div>
                {project ? (
                  <Badge variant="outline" className="capitalize">
                    {project.status.replace("_", " ")}
                  </Badge>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-5">
                {project ? (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold leading-snug text-balance">
                        {project.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {project.abstract}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {project.keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="font-normal">
                          {kw}
                        </Badge>
                      ))}
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Student name
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {profile?.fullName || shellUser.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Interests
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {splitCsv(profile?.interests).length || 0} saved
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Milestones
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {completed} of {milestones.length} complete
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button asChild size="sm">
                        <Link href="/dashboard/student/project">
                          View full project
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/student/project-timeline">
                          <Calendar className="mr-2 h-4 w-4" />
                          Timeline
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">No project yet</h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Create a project proposal to start working with a supervisor.
                    </p>
                    <Button asChild className="mt-4">
                      <Link href="/dashboard/student/project">Create project</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg">Upcoming milestones</CardTitle>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard/student/project-timeline">
                    View all
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>

              <CardContent>
                {upcomingMilestones.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {project
                      ? "All milestones complete. Great work!"
                      : "Create a project to generate your timeline."}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {upcomingMilestones.slice(0, 4).map((m) => {
                      const days = daysUntil(m.dueDate)
                      const urgent = days <= 14

                      return (
                        <li
                          key={m.id}
                          className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                m.status === "in_progress"
                                  ? "bg-primary/10 text-primary"
                                  : urgent
                                  ? "bg-warning/10 text-warning"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Target className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium leading-tight">{m.title}</p>
                                {m.isCriticalPath ? (
                                  <Badge
                                    variant="outline"
                                    className="border-warning/40 text-xs text-warning"
                                  >
                                    Critical path
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {m.description}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold">
                              {formatShortDate(m.dueDate)}
                            </p>
                            <p
                              className={cn(
                                "text-xs",
                                urgent ? "text-warning" : "text-muted-foreground"
                              )}
                            >
                              {days > 0 ? `in ${days}d` : "due today"}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {recentActivity.map((a) => {
                    const Icon = a.icon
                    return (
                      <li key={a.id} className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            a.tone === "success" && "bg-success/10 text-success",
                            a.tone === "primary" && "bg-primary/10 text-primary",
                            a.tone === "chart" && "bg-chart-2/10 text-chart-2"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-medium leading-tight">{a.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{a.meta}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Supervisor</CardTitle>
              </CardHeader>

              <CardContent>
                {!supervisor ? (
                  <div className="text-sm text-muted-foreground">
                    No supervisor assigned yet. Use "Find Supervisor" to send a request.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold">{supervisor.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {supervisor.email}
                    </p>

                    {supervisor.expertise && (
                      <div className="flex flex-wrap gap-1.5">
                        {supervisor.expertise.split(",").map((e: string) => (
                          <Badge key={e} variant="secondary" className="text-xs">
                            {e.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {supervisor ? (
              <Card className="border-primary/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg">Your supervisor</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 border">
                      <AvatarImage src="/placeholder.svg" alt="" />
                      <AvatarFallback>
                        {getInitials(supervisor.fullName || "Supervisor")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold">
                        {supervisor.fullName || "Assigned Supervisor"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {supervisor.email}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-success/40 text-xs text-success"
                      >
                        Active supervision
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Expertise
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {splitCsv(supervisor.expertise)
                        .slice(0, 4)
                        .map((e) => (
                          <Badge key={e} variant="secondary" className="font-normal">
                            {e}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link
                        href={`/dashboard/messages?userId=${supervisor.id}&name=${encodeURIComponent(
                          supervisor.fullName || "Supervisor"
                        )}`}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link
                        href={`/dashboard/meetings?userId=${supervisor.id}&name=${encodeURIComponent(
                          supervisor.fullName || "Supervisor"
                        )}`}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Meeting
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg">
                      {latestRequest ? "Supervisor request status" : "Find supervisor"}
                    </CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {latestRequest
                      ? latestRequest.status === "pending"
                        ? "Your request is pending supervisor review."
                        : latestRequest.status === "accepted"
                          ? "Your request has been accepted. Assignment will appear shortly."
                          : "Your latest request was declined. You can request another supervisor."
                      : "No supervisor assigned yet. Send a request to get started."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestRequest && (
                    <div className="rounded-lg border bg-background/70 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {latestRequest.supervisorName || "Supervisor"}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            latestRequest.status === "accepted" &&
                              "border-success/40 text-success",
                            latestRequest.status === "pending" &&
                              "border-warning/40 text-warning",
                            latestRequest.status === "declined" &&
                              "border-destructive/40 text-destructive"
                          )}
                        >
                          {latestRequest.status}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {latestRequest.supervisorEmail}
                      </p>
                    </div>
                  )}
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href="/dashboard/student/find-supervisor">
                      {latestRequest?.status === "declined"
                        ? "Find another supervisor"
                        : "Explore supervisor matches"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Progress summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall completion</span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-success/10 p-3 text-center">
                    <p className="text-2xl font-bold text-success">{completed}</p>
                    <p className="text-xs text-muted-foreground">Done</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{inProgress}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-2xl font-bold">{remaining - inProgress}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/student/profile">
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Update profile
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/student/project">
                    <FileText className="mr-2 h-4 w-4" />
                    {project ? "Edit project" : "Create project"}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/student/find-supervisor">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Find supervisor
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/dashboard/notifications">
                    <Bell className="mr-2 h-4 w-4" />
                    View notifications
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
