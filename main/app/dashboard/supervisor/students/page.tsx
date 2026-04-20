"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Users,
  FolderKanban,
  Search,
  Filter,
  MessageSquare,
  UserRound,
  Calendar,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@/types"

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

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

type SortMode = "name" | "progress"

type ApiStudentItem = {
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
  } | null
  progress: number
  completedMilestones: number
  totalMilestones: number
  nextMilestone: {
    id: string
    status: string
    dueDate: string
    title: string
  } | null
}

type LocalStudent = {
  id: string
  name: string
  email: string
  avatarUrl: string
  skills: string[]
  researchInterests: string[]
  project: {
    id: string
    title: string
    abstract: string
    keywords: string[]
    status: string
  } | null
  progress: number
  completedMilestones: number
  totalMilestones: number
  nextMilestone: {
    id: string
    status: string
    dueDate: string
    title: string
  } | null
}

const fallbackUser: User = {
  id: "supervisor",
  email: "supervisor@example.com",
  name: "Supervisor",
  role: "supervisor",
  createdAt: new Date(0).toISOString(),
}

export default function SupervisorStudentsPage() {
  const [students, setStudents] = useState<LocalStudent[]>([])
  const [shellUser, setShellUser] = useState<User>(fallbackUser)
  const [maxStudents, setMaxStudents] = useState(5)
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortMode>("progress")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchStudents() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const [studentsRes, meRes] = await Promise.all([
          fetch("/api/supervisor/students", {
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

        const studentsData = await studentsRes.json()
        const meData = await meRes.json()

        if (!studentsRes.ok) {
          throw new Error(studentsData?.error || "Failed to load students")
        }

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load supervisor profile")
        }

        const meUser = meData.user
        setShellUser({
          id: meUser?.id || fallbackUser.id,
          email: meUser?.email || fallbackUser.email,
          name:
            meUser?.supervisorProfile?.fullName ||
            meUser?.email?.split("@")?.[0] ||
            "Supervisor",
          role: "supervisor",
          createdAt:
            typeof meUser?.createdAt === "string"
              ? meUser.createdAt
              : fallbackUser.createdAt,
          avatarUrl: "/placeholder.svg",
        })
        setMaxStudents(Math.max(1, meUser?.supervisorProfile?.maxCapacity ?? 5))

        const apiStudents: ApiStudentItem[] = studentsData.students || []

        const mapped: LocalStudent[] = apiStudents.map((item) => ({
          id: item.student.id,
          name: item.student.fullName || "Unnamed Student",
          email: item.student.email,
          avatarUrl: "",
          skills: splitCsv(item.student.skills),
          researchInterests: splitCsv(item.student.interests),
          project: item.project
            ? {
                id: item.project.id,
                title: item.project.title || "Untitled Project",
                abstract:
                  item.project.description || "No project description provided.",
                keywords: splitCsv(item.project.keywords),
                status: item.project.status || "draft",
              }
            : null,
          progress: item.progress,
          completedMilestones: item.completedMilestones,
          totalMilestones: item.totalMilestones,
          nextMilestone: item.nextMilestone,
        }))

        setStudents(mapped)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load students.")
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

  const filtered = useMemo(() => {
    const list = [...students].filter((s) => {
      const q = query.trim().toLowerCase()
      if (!q) return true

      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.skills.some((k) => k.toLowerCase().includes(q)) ||
        s.researchInterests.some((k) => k.toLowerCase().includes(q)) ||
        (s.project?.title || "").toLowerCase().includes(q)
      )
    })

    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      return b.progress - a.progress
    })

    return list
  }, [students, query, sortBy])

  const activeProjects = students.filter((s) => s.project).length
  const currentStudents = students.length
  const availableSlots = Math.max(maxStudents - currentStudents, 0)
  const capacityPct = Math.round((currentStudents / maxStudents) * 100)

  const stats = [
    {
      label: "Assigned Students",
      value: students.length,
      icon: UserRound,
      tone: "primary" as const,
    },
    {
      label: "Active Projects",
      value: activeProjects,
      icon: FolderKanban,
      tone: "success" as const,
    },
    {
      label: "Capacity Used",
      value: `${capacityPct}%`,
      icon: TrendingUp,
      tone: "chart-2" as const,
    },
    {
      label: "Available Slots",
      value: availableSlots,
      icon: Users,
      tone: "warning" as const,
    },
  ]

  const toneStyles = {
    primary: { bg: "bg-primary/10", fg: "text-primary" },
    warning: { bg: "bg-warning/10", fg: "text-warning" },
    success: { bg: "bg-success/10", fg: "text-success" },
    "chart-2": { bg: "bg-chart-2/10", fg: "text-chart-2" },
  } as const

  if (loading) {
    return (
      <DashboardShell
        user={shellUser}
        role="supervisor"
        title="My Students"
      >
        <div className="p-6">Loading students...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      user={shellUser}
      role="supervisor"
      title="My Students"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">
              {error}
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
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="truncate text-xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader className="space-y-4">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Assigned Students</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} of {students.length}{" "}
                    {students.length === 1 ? "student" : "students"}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, skill, or interest..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as SortMode)}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="progress">
                        Progress (high → low)
                      </SelectItem>
                      <SelectItem value="name">Name (A → Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-12 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">No students found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {students.length === 0
                        ? "No students are currently assigned to you."
                        : "Try adjusting your search."}
                    </p>
                  </div>
                ) : (
                  filtered.map((student) => (
                    <StudentCard key={student.id} student={student} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supervision Load</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums">
                      {currentStudents}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}/ {maxStudents}
                      </span>
                    </span>
                    <Badge variant="secondary">{capacityPct}%</Badge>
                  </div>
                  <Progress value={capacityPct} className="h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {availableSlots} slot{availableSlots === 1 ? "" : "s"}{" "}
                    available
                  </p>
                </div>

                <Separator />

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total assigned</span>
                    <span className="font-semibold tabular-nums">
                      {students.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Projects linked</span>
                    <span className="font-semibold tabular-nums">
                      {activeProjects}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supervisor Tip</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="leading-relaxed">
                  Use the progress bars to quickly spot students who may need
                  extra support before their next milestone.
                </p>
                <p className="leading-relaxed">
                  Leaving feedback directly on milestones helps keep the timeline
                  recommendations up to date.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function StudentCard({ student }: { student: LocalStudent }) {
  const delayed =
    student.totalMilestones > 0 && student.progress < 40 ? 1 : 0

  return (
    <div className="rounded-xl border p-5 transition-colors hover:border-primary/40">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage
              src={student.avatarUrl || "/placeholder.svg"}
              alt={student.name}
            />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(student.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold leading-tight">
                  {student.name}
                </h3>
                <Badge variant="secondary">
                  {student.totalMilestones} milestone
                  {student.totalMilestones === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {student.email}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {student.skills.slice(0, 5).map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-[10px]">
                    {skill}
                  </Badge>
                ))}
                {student.skills.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{student.skills.length - 5}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Research Interests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {student.researchInterests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="outline"
                    className="border-primary/30 text-[10px] text-primary"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-48">
          <Button asChild size="sm" variant="default">
            <Link href={`/dashboard/supervisor/students/${student.id}`}>
              <UserRound className="mr-2 h-4 w-4" />
              View Profile
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link
              href={`/dashboard/messages?userId=${student.id}&name=${encodeURIComponent(
                student.name
              )}`}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Student
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline">
            <Link
              href={`/dashboard/meetings?userId=${student.id}&name=${encodeURIComponent(
                student.name
              )}`}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Link>
          </Button>

          <Button asChild size="sm" variant="ghost">
            <Link href={`/dashboard/supervisor/feedback?studentId=${student.id}`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Leave Feedback
            </Link>
          </Button>
        </div>
      </div>

      {student.project ? (
        <>
          <Separator className="my-4" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Current Project
                  </p>
                </div>
                <p className="font-medium leading-snug">{student.project.title}</p>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {student.project.abstract}
                </p>
              </div>

              <Badge
                variant={delayed > 0 ? "outline" : "secondary"}
                className={
                  delayed > 0
                    ? "border-destructive/30 text-destructive"
                    : "bg-success/10 text-success"
                }
              >
                {delayed > 0
                  ? `${delayed} delayed`
                  : student.totalMilestones > 0
                    ? "On track"
                    : "No milestones"}
              </Badge>
            </div>

            {student.totalMilestones > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Milestone progress
                  </span>
                  <span className="font-medium tabular-nums">
                    {student.completedMilestones}/{student.totalMilestones} (
                    {student.progress}%)
                  </span>
                </div>
                <Progress value={student.progress} className="h-1.5" />
              </div>
            )}

            {student.nextMilestone && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  Next:{" "}
                  <span className="font-medium">
                    {student.nextMilestone.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(student.nextMilestone.dueDate)}
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Separator className="my-4" />
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span>No active project yet — reach out to help them scope one.</span>
          </div>
        </>
      )}
    </div>
  )
}
