"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  MessageSquare,
  Save,
  Calendar,
  UserRound,
  FolderKanban,
  ArrowUpRight,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
    isCriticalPath?: boolean
    feedback?: string | null
    completedDate?: string | null
  } | null
}

type FeedbackMilestone = {
  id: string
  studentId: string
  title: string
  description: string
  dueDate: string
  status: string
  isCriticalPath: boolean
  feedback: string | null
  completedDate: string | null
  studentName: string
  studentEmail: string
  projectTitle: string
}

const fallbackUser: User = {
  id: "supervisor",
  email: "supervisor@example.com",
  name: "Supervisor",
  role: "supervisor",
  createdAt: new Date(0).toISOString(),
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function SupervisorFeedbackPage() {
  const searchParams = useSearchParams()
  const selectedStudentId = searchParams.get("studentId") || ""

  const [shellUser, setShellUser] = useState<User>(fallbackUser)
  const [milestones, setMilestones] = useState<FeedbackMilestone[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    async function fetchData() {
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

        const students: ApiStudentEntry[] = studentsData.students || []

        const allMilestones: FeedbackMilestone[] = students.flatMap((entry) => {
          const studentName = entry.student.fullName || "Unnamed Student"
          const studentEmail = entry.student.email
          const studentId = entry.student.id
          const projectTitle = entry.project?.title || "Untitled Project"
          const projectMilestones = entry.project?.milestones || []

          return projectMilestones.map((milestone) => ({
            id: milestone.id,
            studentId,
            title: milestone.title,
            description: milestone.description || "",
            dueDate: milestone.dueDate,
            status: milestone.status,
            isCriticalPath: milestone.isCriticalPath,
            feedback: milestone.feedback,
            completedDate: milestone.completedDate,
            studentName,
            studentEmail,
            projectTitle,
          }))
        })

        setMilestones(allMilestones)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load milestones.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredMilestones = useMemo(() => {
    const q = query.trim().toLowerCase()
    return milestones.filter((milestone) => {
      if (selectedStudentId && milestone.studentId !== selectedStudentId) {
        return false
      }
      if (!q) return true
      return (
        milestone.title.toLowerCase().includes(q) ||
        milestone.studentName.toLowerCase().includes(q) ||
        milestone.studentEmail.toLowerCase().includes(q) ||
        milestone.projectTitle.toLowerCase().includes(q) ||
        milestone.status.toLowerCase().includes(q)
      )
    })
  }, [milestones, query, selectedStudentId])

  const summary = useMemo(() => {
    const total = filteredMilestones.length
    const completed = filteredMilestones.filter((m) => m.status === "completed").length
    const delayed = filteredMilestones.filter((m) => m.status === "delayed").length
    const noFeedback = filteredMilestones.filter((m) => !m.feedback).length
    return { total, completed, delayed, noFeedback }
  }, [filteredMilestones])

  async function saveFeedback(milestoneId: string) {
    try {
      setError("")
      setSavingId(milestoneId)
      const token = localStorage.getItem("token")

      const feedbackValue = drafts[milestoneId] ?? ""

      const res = await fetch("/api/supervisor/milestone-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          milestoneId,
          feedback: feedbackValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save feedback")
      }

      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? { ...m, feedback: feedbackValue }
            : m
        )
      )
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not save feedback.")
    } finally {
      setSavingId("")
    }
  }

  if (loading) {
    return (
      <DashboardShell
        user={shellUser}
        role="supervisor"
        title="Milestone Feedback"
      >
        <div className="p-6">Loading feedback page...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      user={shellUser}
      role="supervisor"
      title="Milestone Feedback"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">
              {error}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">All Milestones</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review progress and leave feedback across all assigned students
              </p>
            </div>

            <div>
              <Input
                placeholder="Search by student, project, milestone, or status..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {selectedStudentId && (
              <div className="text-xs text-muted-foreground">
                Filtered to one student from the profile/actions page.
              </div>
            )}
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Milestones</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Delayed</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.delayed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Need Feedback</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.noFeedback}</p>
            </CardContent>
          </Card>
        </div>

        {filteredMilestones.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No milestones available for feedback yet.
            </CardContent>
          </Card>
        ) : (
          filteredMilestones.map((milestone) => (
            <Card key={milestone.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {milestone.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {milestone.studentName}
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5" />
                        {milestone.projectTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(milestone.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {milestone.status.replace("_", " ")}
                    </Badge>
                    {milestone.isCriticalPath && (
                      <Badge variant="outline" className="text-warning border-warning/30">
                        Critical
                      </Badge>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/dashboard/supervisor/students/${milestone.studentId}`}>
                        View Student
                        <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {milestone.description && (
                  <p className="text-sm text-muted-foreground">
                    {milestone.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                <Textarea
                  value={drafts[milestone.id] ?? milestone.feedback ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [milestone.id]: e.target.value,
                    }))
                  }
                  placeholder="Write milestone feedback for the student..."
                  rows={4}
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {milestone.feedback ? "Existing feedback saved." : "No feedback saved yet."}
                  </div>

                  <Button
                    onClick={() => saveFeedback(milestone.id)}
                    disabled={savingId === milestone.id}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingId === milestone.id ? "Saving..." : "Save Feedback"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardShell>
  )
}
