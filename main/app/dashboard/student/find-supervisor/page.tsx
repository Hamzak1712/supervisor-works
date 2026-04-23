"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Sparkles,
  Search,
  Filter,
  Target,
  TrendingUp,
  Users,
  Award,
  Info,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { SupervisorMatches } from "@/components/student/SupervisorMatches"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { SupervisorMatch, User } from "@/types"

type MinScore = "all" | "90" | "75" | "60"

type ApiMatch = {
  supervisor: {
    id: string
    userId: string
    fullName: string | null
    email: string
    expertise: string[]
    maxCapacity: number
    assignedStudents?: number
    requestStatus?: string | null
  }
  matchScore: number
  matchReasons: string[]
  source?: "rule_based" | "gemini"
}

type MatchingResponse = {
  project?: {
    keywords?: string[]
    status?: string | null
  }
  matches?: ApiMatch[]
  settings?: {
    aiExplanationEnabled?: boolean
  }
}

type ProfileResponse = {
  profile?: {
    skills?: string | null
    interests?: string | null
  }
}

const fallbackShellUser: User = {
  id: "student",
  email: "student@example.com",
  name: "Student",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function FindSupervisorPage() {
  const [query, setQuery] = useState("")
  const [expertise, setExpertise] = useState<string>("all")
  const [minScore, setMinScore] = useState<MinScore>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [matches, setMatches] = useState<SupervisorMatch[]>([])
  const [requestStatusMap, setRequestStatusMap] = useState<Record<string, string>>({})
  const [studentSkills, setStudentSkills] = useState<string[]>([])
  const [studentInterests, setStudentInterests] = useState<string[]>([])
  const [projectKeywords, setProjectKeywords] = useState<string[]>([])
  const [projectStatus, setProjectStatus] = useState<string | null>(null)
  const [matchingUsesAi, setMatchingUsesAi] = useState(false)
  const [workingId, setWorkingId] = useState("")
  const { toast } = useToast()

  const fetchMatches = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (!options?.silent) {
          setError("")
        }
        const token = localStorage.getItem("token")

        const [matchingRes, profileRes, meRes] = await Promise.all([
          fetch("/api/student/matching", {
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

        const matchingData: MatchingResponse = await matchingRes.json()
        const profileData: ProfileResponse = await profileRes.json()
        const meData = await meRes.json()

        if (!matchingRes.ok) {
          throw new Error((matchingData as any)?.error || "Failed to load matches")
        }

        if (!profileRes.ok) {
          throw new Error((profileData as any)?.error || "Failed to load profile")
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

        const apiMatches: ApiMatch[] = matchingData.matches || []

        const mappedMatches: SupervisorMatch[] = apiMatches.map((m) => ({
          supervisor: {
            id: m.supervisor.userId,
            email: m.supervisor.email,
            name: m.supervisor.fullName || "Unnamed Supervisor",
            role: "supervisor",
            avatarUrl: "",
            createdAt: "",
            department: "School of Computing",
            expertise: m.supervisor.expertise,
            researchAreas: m.supervisor.expertise,
            maxStudents: m.supervisor.maxCapacity,
            currentStudents: m.supervisor.assignedStudents ?? 0,
            pastProjects: [],
            bio: "Profile details will be expanded when full supervisor records are connected.",
          },
          matchScore: m.matchScore,
          matchReasons: m.matchReasons,
          similarProjects: [],
          source: m.source || "rule_based",
        }))

        const statuses = apiMatches.reduce<Record<string, string>>((acc, m) => {
          if (m.supervisor.requestStatus) {
            acc[m.supervisor.userId] = m.supervisor.requestStatus
          }
          return acc
        }, {})

        setMatches(mappedMatches)
        setRequestStatusMap(statuses)
        setStudentSkills(splitCsv(profileData.profile?.skills))
        setStudentInterests(splitCsv(profileData.profile?.interests))
        setProjectKeywords(matchingData.project?.keywords || [])
        setProjectStatus(matchingData.project?.status || null)
        setMatchingUsesAi(
          apiMatches.some((entry) => entry.source === "gemini") &&
            Boolean(matchingData.settings?.aiExplanationEnabled)
        )
        setError("")
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load supervisor matches.")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    function refreshOnVisible() {
      if (document.visibilityState === "visible") {
        void fetchMatches({ silent: true })
      }
    }

    void fetchMatches()
    const interval = window.setInterval(() => {
      void fetchMatches({ silent: true })
    }, 10000)

    window.addEventListener("focus", refreshOnVisible)
    document.addEventListener("visibilitychange", refreshOnVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refreshOnVisible)
      document.removeEventListener("visibilitychange", refreshOnVisible)
    }
  }, [fetchMatches])

  const filtered: SupervisorMatch[] = useMemo(() => {
    let list = [...matches]

    if (expertise !== "all") {
      list = list.filter((m) =>
        m.supervisor.expertise.some((e) => e === expertise)
      )
    }

    if (minScore !== "all") {
      const threshold = Number(minScore)
      list = list.filter((m) => m.matchScore >= threshold)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (m) =>
          m.supervisor.name.toLowerCase().includes(q) ||
          m.supervisor.department.toLowerCase().includes(q) ||
          m.supervisor.expertise.some((e) => e.toLowerCase().includes(q)) ||
          m.supervisor.researchAreas.some((e) => e.toLowerCase().includes(q))
      )
    }

    list.sort((a, b) => b.matchScore - a.matchScore)
    return list
  }, [matches, query, expertise, minScore])

  async function handleSendRequest(supervisorId: string) {
    const currentStatus = requestStatusMap[supervisorId]

    if (
      currentStatus === "pending" ||
      currentStatus === "accepted" ||
      workingId === supervisorId
    ) {
      return
    }

    try {
      setWorkingId(supervisorId)

      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/request-supervisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supervisorId,
          message:
            "I would like to request you as my supervisor for my final year project.",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to send request")
      }

      setRequestStatusMap((prev) => ({
        ...prev,
        [supervisorId]: "pending",
      }))
      void fetchMatches({ silent: true })

      const supervisor = matches.find((m) => m.supervisor.id === supervisorId)?.supervisor

      toast({
        title: "Supervision request sent",
        description: supervisor
          ? `${supervisor.name} has been sent your request.`
          : "Your request has been sent.",
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Request failed",
        description: err?.message || "Could not send request.",
        variant: "destructive",
      })
    } finally {
      setWorkingId("")
    }
  }

  const decoratedMatches = filtered.map((m) => {
    const status = requestStatusMap[m.supervisor.id]

    return {
      ...m,
      supervisor: {
        ...m.supervisor,
        currentStudents:
          status === "pending" || status === "accepted"
            ? m.supervisor.maxStudents
            : 0,
        bio:
          status === "accepted"
            ? `${m.supervisor.bio} Supervisor request accepted.`
            : status === "pending"
            ? `${m.supervisor.bio} Supervisor request pending.`
            : status === "declined"
            ? `${m.supervisor.bio} Previous request declined.`
            : m.supervisor.bio,
      },
      matchReasons:
        status === "accepted"
          ? [...m.matchReasons, "Your supervision request has been accepted."]
          : status === "pending"
          ? [...m.matchReasons, "You have already sent a request to this supervisor."]
          : status === "declined"
          ? [...m.matchReasons, "A previous request to this supervisor was declined."]
          : m.matchReasons,
    }
  })

  const best = matches[0]
  const topThreshold = matches.filter((m) => m.matchScore >= 75).length
  const requestsSentCount = Object.values(requestStatusMap).filter(
    (status) => status === "pending" || status === "accepted"
  ).length

  const availableExpertise = useMemo(() => {
    const set = new Set<string>()
    matches.forEach((m) => m.supervisor.expertise.forEach((e) => set.add(e)))
    return Array.from(set).sort()
  }, [matches])

  const stats = [
    {
      label: "Total Matches",
      value: matches.length,
      icon: Users,
      tone: "primary" as const,
    },
    {
      label: "Top Match",
      value: best ? `${best.matchScore}%` : "—",
      icon: Award,
      tone: "success" as const,
    },
    {
      label: "Good Fits (75%+)",
      value: topThreshold,
      icon: Target,
      tone: "chart-2" as const,
    },
    {
      label: "Requests Sent",
      value: requestsSentCount,
      icon: Sparkles,
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
      <DashboardShell user={shellUser} role="student" title="Find Supervisor">
        <div className="p-6">Loading supervisor matches...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      user={shellUser}
      role="student"
      title="Find Supervisor"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-pretty text-xl font-semibold leading-tight">
                  AI-matched supervisors for your project
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Matches are ranked by how well each supervisor&apos;s expertise
                  aligns with your skills, research interests, and project
                  abstract. Review the &quot;why this match&quot; reasons before
                  sending a request.
                </p>
                <p className="text-xs text-muted-foreground">
                  {matchingUsesAi
                    ? "Gemini explanations are enabled for these recommendations."
                    : "Recommendations are currently using rule-based scoring (AI may be disabled or Gemini is unavailable)."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader className="space-y-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Refine Matches</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Showing {decoratedMatches.length} of {matches.length} recommended
                    supervisors
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, department, or research..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={expertise}
                    onValueChange={(v) => setExpertise(v)}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Expertise" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All expertise</SelectItem>
                      {availableExpertise.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={minScore}
                    onValueChange={(v) => setMinScore(v as MinScore)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any score</SelectItem>
                      <SelectItem value="90">90%+ only</SelectItem>
                      <SelectItem value="75">75%+ only</SelectItem>
                      <SelectItem value="60">60%+ only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>

            {decoratedMatches.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">No supervisors match your filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try widening your score range or clearing the expertise
                    filter.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setQuery("")
                      setExpertise("all")
                      setMinScore("all")
                    }}
                  >
                    Reset filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <SupervisorMatches
                matches={decoratedMatches}
                onSendRequest={handleSendRequest}
              />
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-4 w-4 text-primary" />
                  What We&apos;re Matching
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Based on your profile
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Research interests
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {studentInterests.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No interests saved yet
                      </span>
                    )}
                    {studentInterests.map((i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-primary/30 text-[10px] text-primary"
                      >
                        {i}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {studentSkills.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No skills saved yet
                      </span>
                    )}
                    {studentSkills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Project keywords</span>
                    <span className="font-medium">
                      {projectKeywords.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Project status</span>
                    <span className="font-medium capitalize">{projectStatus || "draft"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  How Matching Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      1
                    </span>
                    <span className="leading-relaxed">
                      We compare your saved project keywords, interests, skills,
                      and description against supervisor expertise.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      2
                    </span>
                    <span className="leading-relaxed">
                      Supervisors are ranked by score and explained with clear
                      match reasons.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      3
                    </span>
                    <span className="leading-relaxed">
                      Gemini refines the top candidates and generates specific
                      &quot;why this match&quot; explanations when AI is enabled.
                    </span>
                  </li>
                </ol>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Score guide
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      <span>90%+ — excellent fit</span>
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Popular Expertise</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={expertise === "all" ? "default" : "outline"}
                  className="h-7"
                  onClick={() => setExpertise("all")}
                >
                  All
                </Button>
                {availableExpertise.slice(0, 10).map((tag) => (
                  <Button
                    key={tag}
                    size="sm"
                    variant={expertise === tag ? "default" : "outline"}
                    className="h-7"
                    onClick={() => setExpertise(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Matching Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="leading-relaxed">
                  Review each supervisor&apos;s past projects — they&apos;re the
                  clearest signal of their real research direction.
                </p>
                <p className="leading-relaxed">
                  Don&apos;t send requests to more than 2–3 supervisors at once.
                  Focus on the best fit first.
                </p>
                <p className="leading-relaxed">
                  A strong, specific project abstract always gives better matches
                  than a generic one.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
