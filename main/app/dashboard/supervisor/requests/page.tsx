"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ClipboardList,
  Clock3,
  CheckCircle2,
  Sparkles,
  FolderOpen,
  Search,
  Check,
  X,
  Mail,
  Calendar,
  Filter,
  Inbox,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

type RequestStatus = "pending" | "accepted" | "declined"

type ApiRequest = {
  id: string
  status: string
  message: string | null
  createdAt: string
  respondedAt: string | null
  responseMessage: string | null
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

type LocalRequest = {
  id: string
  studentId: string
  projectId: string
  status: RequestStatus
  matchScore: number
  matchReasons: string[]
  message: string | null
  createdAt: string
  respondedAt?: string | null

  student: {
    id: string
    name: string
    email: string
    avatarUrl: string
    skills: string[]
    interests: string[]
  }

  project: {
    id: string
    title: string
    abstract: string
    keywords: string[]
  } | null
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function calculateMatchScore(skills: string[], interests: string[], keywords: string[]) {
  const totalSignals = skills.length + interests.length + keywords.length

  if (totalSignals >= 9) return 92
  if (totalSignals >= 7) return 85
  if (totalSignals >= 5) return 78
  if (totalSignals >= 3) return 68
  return 60
}

function buildMatchReasons(skills: string[], interests: string[], keywords: string[]) {
  const reasons: string[] = []

  if (keywords.length > 0) {
    reasons.push(`Project includes ${keywords.slice(0, 3).join(", ")}`)
  }

  if (interests.length > 0) {
    reasons.push(`Student interests include ${interests.slice(0, 2).join(", ")}`)
  }

  if (skills.length > 0) {
    reasons.push(`Student skills include ${skills.slice(0, 3).join(", ")}`)
  }

  if (reasons.length === 0) {
    reasons.push("Request created from saved student project and profile data")
  }

  return reasons
}

const fallbackUser: User = {
  id: "supervisor",
  email: "supervisor@example.com",
  name: "Supervisor",
  role: "supervisor",
  createdAt: new Date(0).toISOString(),
}

export default function SupervisorRequestsPage() {
  const [requests, setRequests] = useState<LocalRequest[]>([])
  const [shellUser, setShellUser] = useState<User>(fallbackUser)
  const [maxStudents, setMaxStudents] = useState(5)
  const [currentStudents, setCurrentStudents] = useState(0)
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<"match" | "newest">("match")
  const [activeTab, setActiveTab] = useState<"pending" | "all" | "accepted" | "declined">(
    "pending"
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [workingId, setWorkingId] = useState("")

  useEffect(() => {
    async function fetchRequests() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const [requestsRes, meRes, studentsRes] = await Promise.all([
          fetch("/api/supervisor/requests", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
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
        ])

        const requestsData = await requestsRes.json()
        const meData = await meRes.json()
        const studentsData = await studentsRes.json()

        if (!requestsRes.ok) {
          throw new Error(requestsData?.error || "Failed to load requests")
        }

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load supervisor profile")
        }

        if (!studentsRes.ok) {
          throw new Error(studentsData?.error || "Failed to load students")
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
        setCurrentStudents((studentsData.students || []).length)

        const apiRequests: ApiRequest[] = requestsData.requests || []

        const mappedRequests: LocalRequest[] = apiRequests.map((request) => {
          const skills = splitCsv(request.student.studentProfile?.skills)
          const interests = splitCsv(request.student.studentProfile?.interests)
          const keywords = splitCsv(request.project?.keywords)

          return {
            id: request.id,
            studentId: request.student.id,
            projectId: request.project?.id || "",
            status:
              request.status === "accepted" || request.status === "declined"
                ? request.status
                : "pending",
            matchScore: calculateMatchScore(skills, interests, keywords),
            matchReasons: buildMatchReasons(skills, interests, keywords),
            message: request.message,
            createdAt: request.createdAt,
            respondedAt: request.respondedAt,

            student: {
              id: request.student.id,
              name: request.student.studentProfile?.fullName || "Unnamed Student",
              email: request.student.email,
              avatarUrl: "",
              skills,
              interests,
            },

            project: request.project
              ? {
                  id: request.project.id,
                  title: request.project.title || "Untitled Project",
                  abstract: request.project.description || "No project description provided.",
                  keywords,
                }
              : null,
          }
        })

        setRequests(mappedRequests)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load supervision requests.")
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [])

  const filtered = useMemo(() => {
    let list = [...requests]

    if (activeTab !== "all") {
      list = list.filter((r) => r.status === activeTab)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((r) => {
        return (
          r.student.name.toLowerCase().includes(q) ||
          r.student.email.toLowerCase().includes(q) ||
          (r.project?.title || "").toLowerCase().includes(q)
        )
      })
    }

    list.sort((a, b) => {
      if (sortBy === "match") return b.matchScore - a.matchScore
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return list
  }, [requests, activeTab, query, sortBy])

  async function updateStatus(id: string, status: RequestStatus) {
    try {
      setError("")
      setWorkingId(id)

      const token = localStorage.getItem("token")

      const res = await fetch("/api/supervisor/respond-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: id,
          action: status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update request")
      }

      let incrementCapacity = false
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? (() => {
                if (r.status === "pending" && status === "accepted") {
                  incrementCapacity = true
                }
                return {
                  ...r,
                  status,
                  respondedAt: data.request?.respondedAt || new Date().toISOString(),
                }
              })()
            : r
        )
      )
      if (incrementCapacity) {
        setCurrentStudents((prev) => Math.min(maxStudents, prev + 1))
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update request.")
    } finally {
      setWorkingId("")
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length
  const acceptedCount = requests.filter((r) => r.status === "accepted").length
  const declinedCount = requests.filter((r) => r.status === "declined").length
  const bestMatch = requests.length ? Math.max(...requests.map((r) => r.matchScore)) : 0
  const availableSlots = Math.max(maxStudents - currentStudents, 0)

  const stats = [
    {
      label: "Total Requests",
      value: requests.length,
      icon: ClipboardList,
      tone: "primary" as const,
    },
    {
      label: "Pending",
      value: pendingCount,
      icon: Clock3,
      tone: "warning" as const,
    },
    {
      label: "Slots Available",
      value: availableSlots,
      icon: CheckCircle2,
      tone: "success" as const,
    },
    {
      label: "Best Match",
      value: `${bestMatch}%`,
      icon: Sparkles,
      tone: "chart-2" as const,
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
        title="Supervision Requests"
      >
        <div className="p-6">Loading requests...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      user={shellUser}
      role="supervisor"
      title="Supervision Requests"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
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

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Incoming Requests</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Review and respond to supervision requests from students
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by student, email, or project..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as "match" | "newest")}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match">Highest match score</SelectItem>
                      <SelectItem value="newest">Newest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                >
                  <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                    <TabsTrigger value="pending" className="gap-2">
                      Pending
                      <Badge
                        variant="secondary"
                        className="bg-warning/10 text-warning"
                      >
                        {pendingCount}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="accepted" className="gap-2">
                      Accepted
                      <Badge
                        variant="secondary"
                        className="bg-success/10 text-success"
                      >
                        {acceptedCount}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="declined" className="gap-2">
                      Declined
                      <Badge variant="secondary">{declinedCount}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="all" className="gap-2">
                      All
                      <Badge variant="secondary">{requests.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={activeTab} className="mt-5 space-y-4">
                    {filtered.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-12 text-center">
                        <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="font-medium">No matching requests</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {query
                            ? "Try adjusting your search or filters."
                            : "You'll see new requests here as they arrive."}
                        </p>
                      </div>
                    ) : (
                      filtered.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          onAccept={() => updateStatus(request.id, "accepted")}
                          onDecline={() => updateStatus(request.id, "declined")}
                          disabled={
                            workingId === request.id ||
                            (availableSlots <= 0 && request.status === "pending")
                          }
                        />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Capacity Summary</CardTitle>
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
                    <Badge variant="secondary">
                      {Math.round((currentStudents / maxStudents) * 100)}
                      %
                    </Badge>
                  </div>
                  <Progress
                    value={(currentStudents / maxStudents) * 100}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-semibold tabular-nums">
                      {pendingCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Accepted</span>
                    <span className="font-semibold tabular-nums">
                      {acceptedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Declined</span>
                    <span className="font-semibold tabular-nums">
                      {declinedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Remaining slots
                    </span>
                    <span className="font-semibold tabular-nums">
                      {availableSlots}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How Matching Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="leading-relaxed">
                  Students are matched to you using their research interests,
                  project abstract, and skills — compared against your expertise
                  and past work.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span>90%+ — strong alignment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>75–89% — good fit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    <span>60–74% — moderate fit</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function RequestCard({
  request,
  onAccept,
  onDecline,
  disabled,
}: {
  request: LocalRequest
  onAccept: () => void
  onDecline: () => void
  disabled: boolean
}) {
  const matchTone =
    request.matchScore >= 90
      ? "text-success"
      : request.matchScore >= 75
      ? "text-primary"
      : "text-warning"

  const statusBadge = (() => {
    switch (request.status) {
      case "accepted":
        return (
          <Badge className="bg-success/10 text-success hover:bg-success/20">
            <Check className="mr-1 h-3 w-3" />
            Accepted
          </Badge>
        )
      case "declined":
        return (
          <Badge
            variant="outline"
            className="border-destructive/30 text-destructive"
          >
            <X className="mr-1 h-3 w-3" />
            Declined
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-warning/30 text-warning">
            <Clock3 className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
    }
  })()

  return (
    <div className="rounded-xl border p-5 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage
              src={request.student.avatarUrl || "/placeholder.svg"}
              alt={request.student.name}
            />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(request.student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">
                {request.student.name}
              </h3>
              {statusBadge}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {request.student.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(request.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-w-[140px] flex-col items-end">
          <span className={`text-2xl font-bold tabular-nums ${matchTone}`}>
            {request.matchScore}%
          </span>
          <span className="text-xs text-muted-foreground">Match score</span>
          <Progress value={request.matchScore} className="mt-2 h-1.5 w-full" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Student Profile Signals
        </p>
        <div className="flex flex-wrap gap-1.5">
          {request.student.skills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-[10px]">
              {skill}
            </Badge>
          ))}
          {request.student.interests.slice(0, 3).map((interest) => (
            <Badge
              key={interest}
              variant="outline"
              className="border-primary/30 text-[10px] text-primary"
            >
              {interest}
            </Badge>
          ))}
          {request.student.skills.length === 0 &&
            request.student.interests.length === 0 && (
              <Badge variant="outline" className="text-[10px]">
                No skills or interests listed yet
              </Badge>
            )}
        </div>
      </div>

      {request.project && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Project Overview</h4>
          </div>
          <p className="font-medium leading-snug">{request.project.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {request.project.abstract}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {request.project.keywords.slice(0, 5).map((k) => (
              <Badge key={k} variant="secondary" className="text-[10px]">
                {k}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Why this match</h4>
        </div>
        <ul className="space-y-1.5">
          {request.matchReasons.map((reason) => (
            <li
              key={reason}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {request.message && (
        <div className="mt-4 rounded-lg border p-4">
          <p className="mb-1 text-sm font-semibold">Student message</p>
          <p className="text-sm text-muted-foreground">{request.message}</p>
        </div>
      )}

      {request.status === "pending" ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={onAccept}
            disabled={disabled}
            className="flex-1 sm:flex-none"
          >
            <Check className="mr-2 h-4 w-4" />
            Accept Request
          </Button>
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={disabled}
            className="flex-1 sm:flex-none"
          >
            <X className="mr-2 h-4 w-4" />
            Decline
          </Button>
          <Button variant="ghost" className="flex-1 sm:flex-none" asChild>
            <Link href={`/dashboard/supervisor/students/${request.studentId}`}>
              View Full Profile
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          {request.respondedAt && (
            <span>Responded {formatDate(request.respondedAt)}</span>
          )}
        </div>
      )}
    </div>
  )
}
