"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Users,
  ClipboardList,
  CheckCircle2,
  Clock3,
  TrendingUp,
  MessageSquare,
  Calendar,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Bell,
  GraduationCap,
  FolderKanban,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { User } from "@/types"

type ApiStudentEntry = {
  student: {
    id: string
    profileId: string
    fullName: string | null
    email: string
    skills: string | null
    interests: string | null
  }
  project: {
    id: string
    title: string | null
    description: string | null
    keywords: string | null
    status: string | null
    milestones: {
      id: string
      title: string
      description: string | null
      dueDate: string
      status: string
      isCriticalPath: boolean
      feedback: string | null
      completedDate: string | null
    }[]
  } | null
  progress: number
  completedMilestones: number
  totalMilestones: number
  nextMilestone: {
    id: string
    title: string
    dueDate: string
    status: string
  } | null
}

type ApiRequest = {
  id: string
  status: string
  message: string | null
  createdAt: string
  respondedAt: string | null
  student: {
    id: string
    email: string
    studentProfile: {
      fullName: string | null
      skills: string | null
      interests: string | null
    } | null
  }
  project: {
    id: string
    title: string | null
    description: string | null
    keywords: string | null
    status: string | null
  } | null
}

type StudentOverview = {
  id: string
  name: string
  email: string
  avatarUrl: string
  projectTitle: string
  progress: number
  completedMilestones: number
  totalMilestones: number
  delayedMilestones: number
  overdueMilestones: number
  nextMilestone: {
    id: string
    title: string
    dueDate: string
    status: string
  } | null
}

type RequestOverview = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  projectTitle: string
  createdAt: string
  status: "pending" | "accepted" | "declined"
  matchScore: number
}

const fallbackShellUser: User = {
  id: "supervisor",
  email: "supervisor@example.com",
  name: "Supervisor",
  role: "supervisor",
  createdAt: new Date(0).toISOString(),
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

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return formatDate(dateStr)
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function calculateMatchScore(
  skills: string[],
  interests: string[],
  keywords: string[]
) {
  const totalSignals = skills.length + interests.length + keywords.length
  if (totalSignals >= 9) return 92
  if (totalSignals >= 7) return 85
  if (totalSignals >= 5) return 78
  if (totalSignals >= 3) return 68
  return 60
}

export default function SupervisorDashboardPage() {
  const router = useRouter()
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [students, setStudents] = useState<StudentOverview[]>([])
  const [requests, setRequests] = useState<RequestOverview[]>([])
  const [maxStudents, setMaxStudents] = useState(5)
  const [expertise, setExpertise] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const [meRes, studentsRes, requestsRes] = await Promise.all([
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/supervisor/students", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/supervisor/requests", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const meData = await meRes.json()
        const studentsData = await studentsRes.json()
        const requestsData = await requestsRes.json()

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load supervisor profile")
        }

        if (meData?.needsOnboarding) {
          router.replace("/onboarding/supervisor")
          return
        }

        if (!studentsRes.ok) {
          throw new Error(studentsData?.error || "Failed to load students")
        }

        if (!requestsRes.ok) {
          throw new Error(requestsData?.error || "Failed to load requests")
        }

        const meUser = meData.user
        setShellUser({
          id: meUser?.id || fallbackShellUser.id,
          email: meUser?.email || fallbackShellUser.email,
          name:
            meUser?.supervisorProfile?.fullName ||
            meUser?.email?.split("@")?.[0] ||
            "Supervisor",
          role: "supervisor",
          createdAt:
            typeof meUser?.createdAt === "string"
              ? meUser.createdAt
              : fallbackShellUser.createdAt,
          avatarUrl: "/placeholder.svg",
        })

        const liveMaxStudents = Math.max(
          1,
          meUser?.supervisorProfile?.maxCapacity ?? 5
        )
        setMaxStudents(liveMaxStudents)
        setExpertise(splitCsv(meUser?.supervisorProfile?.expertise))

        const apiStudents: ApiStudentEntry[] = studentsData.students || []
        const normalizedStudents: StudentOverview[] = apiStudents.map((entry) => {
          const milestones = entry.project?.milestones || []
          const delayedMilestones = milestones.filter(
            (m) => m.status === "delayed"
          ).length
          const overdueMilestones = milestones.filter(
            (m) =>
              m.status !== "completed" &&
              new Date(m.dueDate).getTime() < Date.now()
          ).length

          return {
            id: entry.student.id,
            name: entry.student.fullName || "Unnamed Student",
            email: entry.student.email,
            avatarUrl: "",
            projectTitle: entry.project?.title || "No active project",
            progress: entry.progress,
            completedMilestones: entry.completedMilestones,
            totalMilestones: entry.totalMilestones,
            delayedMilestones,
            overdueMilestones,
            nextMilestone: entry.nextMilestone,
          }
        })
        setStudents(normalizedStudents)

        const apiRequests: ApiRequest[] = requestsData.requests || []
        const normalizedRequests: RequestOverview[] = apiRequests.map((entry) => {
          const skills = splitCsv(entry.student.studentProfile?.skills)
          const interests = splitCsv(entry.student.studentProfile?.interests)
          const keywords = splitCsv(entry.project?.keywords)

          return {
            id: entry.id,
            studentId: entry.student.id,
            studentName: entry.student.studentProfile?.fullName || "Unnamed Student",
            studentEmail: entry.student.email,
            projectTitle: entry.project?.title || "Untitled Project",
            createdAt: entry.createdAt,
            status:
              entry.status === "accepted" || entry.status === "declined"
                ? entry.status
                : "pending",
            matchScore: calculateMatchScore(skills, interests, keywords),
          }
        })
        setRequests(normalizedRequests)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load dashboard.")
      } finally {
        setLoading(false)
      }
    }

    void fetchDashboardData()
  }, [])

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  )

  const alertStudents = useMemo(
    () =>
      students.filter(
        (student) => student.delayedMilestones > 0 || student.overdueMilestones > 0
      ),
    [students]
  )

  const onTrackStudents = useMemo(
    () =>
      students.filter(
        (student) => student.delayedMilestones === 0 && student.overdueMilestones === 0
      ),
    [students]
  )

  const avgProgress = students.length
    ? Math.round(
        students.reduce((sum, student) => sum + student.progress, 0) / students.length
      )
    : 0

  const capacityPct = Math.round((students.length / maxStudents) * 100)
  const availableSlots = Math.max(maxStudents - students.length, 0)
  const bestMatch = pendingRequests.length
    ? Math.max(...pendingRequests.map((request) => request.matchScore))
    : 0

  const stats = [
    {
      label: "Current Students",
      value: `${students.length}/${maxStudents}`,
      sub: `${availableSlots} slot${availableSlots === 1 ? "" : "s"} available`,
      icon: Users,
      tone: "primary" as const,
    },
    {
      label: "Pending Requests",
      value: pendingRequests.length,
      sub: bestMatch > 0 ? `Top match ${bestMatch}%` : "No new requests",
      icon: ClipboardList,
      tone: "warning" as const,
    },
    {
      label: "Average Progress",
      value: `${avgProgress}%`,
      sub: `${onTrackStudents.length} on track`,
      icon: TrendingUp,
      tone: "success" as const,
    },
    {
      label: "Needs Attention",
      value: alertStudents.length,
      sub: alertStudents.length > 0 ? "Delayed or overdue tasks" : "All students on track",
      icon: AlertCircle,
      tone: "chart-2" as const,
    },
  ]

  const toneStyles = {
    primary: { bg: "bg-primary/10", fg: "text-primary" },
    warning: { bg: "bg-warning/10", fg: "text-warning" },
    success: { bg: "bg-success/10", fg: "text-success" },
    "chart-2": { bg: "bg-chart-2/10", fg: "text-chart-2" },
  } as const

  const topRequests = [...pendingRequests]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)

  const topStudents = [...students]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4)

  if (loading) {
    return (
      <DashboardShell user={shellUser} role="supervisor" title="Supervisor Dashboard">
        <div className="p-6">Loading dashboard...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="supervisor" title="Supervisor Dashboard">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage
                  src={shellUser.avatarUrl || "/placeholder.svg"}
                  alt={shellUser.name}
                />
                <AvatarFallback className="bg-primary/10 text-lg text-primary">
                  {getInitials(shellUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold leading-tight text-balance">
                    Welcome back, {shellUser.name.split(" ")[0]}
                  </h2>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <GraduationCap className="mr-1 h-3 w-3" />
                    Supervisor
                  </Badge>
                </div>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  You have{" "}
                  <span className="font-medium text-foreground">
                    {pendingRequests.length} pending{" "}
                    {pendingRequests.length === 1 ? "request" : "requests"}
                  </span>
                  {alertStudents.length > 0 ? (
                    <>
                      {" "}and{" "}
                      <span className="font-medium text-warning">
                        {alertStudents.length}{" "}
                        {alertStudents.length === 1 ? "student" : "students"} need attention
                      </span>
                    </>
                  ) : (
                    <> and all students are currently on track</>
                  )}
                  .
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/dashboard/supervisor/requests">
                  <Bell className="mr-2 h-4 w-4" />
                  Review Requests
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/supervisor/students">
                  <Users className="mr-2 h-4 w-4" />
                  My Students
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            const tone = toneStyles[stat.tone]
            return (
              <Card key={stat.label} className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={`rounded-xl p-2.5 ${tone.bg}`}>
                    <Icon className={`h-5 w-5 ${tone.fg}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{stat.sub}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Supervisor Profile
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/supervisor/settings">
                      Edit
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {expertise.length > 0
                    ? "Students are matched using your saved expertise and their project signals."
                    : "Add your expertise in settings to improve student matching quality."}
                </p>

                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Supervision Capacity
                      </p>
                      <p className="text-lg font-semibold tabular-nums">
                        {students.length}
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}/ {maxStudents} students
                        </span>
                      </p>
                    </div>
                    <Badge
                      variant={capacityPct >= 100 ? "outline" : "secondary"}
                      className={
                        capacityPct >= 100 ? "border-destructive/30 text-destructive" : ""
                      }
                    >
                      {capacityPct}%
                    </Badge>
                  </div>
                  <Progress value={capacityPct} className="h-2" />
                  {capacityPct >= 100 && (
                    <p className="text-xs text-destructive">
                      At full capacity. New requests should be reviewed carefully.
                    </p>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Expertise</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {expertise.length > 0 ? (
                      expertise.map((item) => (
                        <Badge key={item} variant="secondary" className="text-[11px]">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[11px]">
                        No expertise tags added yet
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Students &amp; Progress</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Live top performers from assigned students
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/supervisor/students">
                      View all
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {topStudents.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-10 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">No students assigned yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Accept requests to start supervising students.
                    </p>
                  </div>
                ) : (
                  topStudents.map((student) => (
                    <div
                      key={student.id}
                      className="rounded-xl border p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Avatar className="h-11 w-11 shrink-0">
                            <AvatarImage
                              src={student.avatarUrl || "/placeholder.svg"}
                              alt={student.name}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate font-semibold leading-tight">
                                {student.name}
                              </h4>
                              <Badge variant="secondary" className="text-[10px]">
                                {student.totalMilestones} milestones
                              </Badge>
                              {student.delayedMilestones > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/30 text-[10px] text-destructive"
                                >
                                  {student.delayedMilestones} delayed
                                </Badge>
                              ) : student.overdueMilestones > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="border-warning/30 text-[10px] text-warning"
                                >
                                  {student.overdueMilestones} overdue
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="bg-success/10 text-[10px] text-success"
                                >
                                  On track
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {student.projectTitle}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-bold tabular-nums">{student.progress}%</p>
                          <p className="text-[10px] text-muted-foreground">
                            {student.completedMilestones}/{student.totalMilestones} milestones
                          </p>
                        </div>
                      </div>

                      <Progress value={student.progress} className="mt-3 h-1.5" />

                      {student.nextMilestone && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/30 p-2.5 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">
                              Next:{" "}
                              <span className="font-medium text-foreground">
                                {student.nextMilestone.title}
                              </span>
                            </span>
                          </div>
                          <span className="shrink-0 text-muted-foreground">
                            {formatDate(student.nextMilestone.dueDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="h-5 w-5 text-warning" />
                    Recent Requests
                  </CardTitle>
                  {pendingRequests.length > 0 && (
                    <Badge variant="secondary" className="bg-warning/10 text-warning">
                      {pendingRequests.length} new
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {topRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No pending requests</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      New student requests will appear here.
                    </p>
                  </div>
                ) : (
                  topRequests.map((request) => {
                    const matchTone =
                      request.matchScore >= 90
                        ? "text-success"
                        : request.matchScore >= 75
                          ? "text-primary"
                          : "text-warning"

                    return (
                      <div
                        key={request.id}
                        className="space-y-2 rounded-xl border p-3 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-start gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src="/placeholder.svg" alt={request.studentName} />
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">
                              {getInitials(request.studentName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {request.studentName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {request.projectTitle}
                            </p>
                          </div>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${matchTone}`}>
                            {request.matchScore}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatRelative(request.createdAt)}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-warning/30 text-[10px] text-warning"
                          >
                            Pending
                          </Badge>
                        </div>
                      </div>
                    )
                  })
                )}
                {pendingRequests.length > 0 && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/dashboard/supervisor/requests">
                      Review all requests
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {alertStudents.length > 0 && (
              <Card className="border-warning/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {alertStudents.slice(0, 4).map((student) => (
                    <div
                      key={student.id}
                      className="flex items-start gap-3 rounded-lg bg-muted/40 p-3"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src="/placeholder.svg" alt={student.name} />
                        <AvatarFallback className="bg-warning/10 text-xs text-warning">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium leading-tight">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.delayedMilestones > 0
                            ? `${student.delayedMilestones} delayed milestone${
                                student.delayedMilestones === 1 ? "" : "s"
                              }`
                            : `${student.overdueMilestones} overdue milestone${
                                student.overdueMilestones === 1 ? "" : "s"
                              }`}
                          {student.nextMilestone && ` · ${student.nextMilestone.title}`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="shrink-0" asChild>
                        <Link
                          href={`/dashboard/messages?userId=${student.id}&name=${encodeURIComponent(
                            student.name
                          )}`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="sr-only">Message student</span>
                        </Link>
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3"
                  asChild
                >
                  <Link href="/dashboard/supervisor/requests">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Review requests</p>
                      <p className="text-xs text-muted-foreground">
                        {pendingRequests.length} pending
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3"
                  asChild
                >
                  <Link href="/dashboard/supervisor/students">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Check milestones</p>
                      <p className="text-xs text-muted-foreground">
                        {students.length} active student{students.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3"
                  asChild
                >
                  <Link href="/dashboard/supervisor/feedback">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Leave feedback</p>
                      <p className="text-xs text-muted-foreground">
                        Comment on milestones and progress
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3"
                  asChild
                >
                  <Link href="/dashboard/meetings">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">Meetings</p>
                      <p className="text-xs text-muted-foreground">
                        View upcoming and past meetings
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
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
