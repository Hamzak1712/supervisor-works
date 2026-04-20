"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  UserRound,
  Mail,
  FolderKanban,
  Calendar,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Lock,
  MessageSquare,
  ArrowLeft,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@/types"

type ApiStudentDetail = {
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
    milestones: Array<{
      id: string
      projectId: string
      title: string
      description: string | null
      dueDate: string
      status: string
      isCriticalPath: boolean
      feedback: string | null
      completedDate: string | null
    }>
  } | null
  progress: number
  completedMilestones: number
  totalMilestones: number
  delayedMilestones: number
  nextMilestone: {
    id: string
    title: string
    dueDate: string
    status: string
  } | null
}

const fallbackUser: User = {
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

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function SupervisorStudentDetailPage() {
  const params = useParams<{ studentId: string }>()
  const studentId = params?.studentId || ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shellUser, setShellUser] = useState<User>(fallbackUser)
  const [detail, setDetail] = useState<ApiStudentDetail | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const [detailRes, meRes] = await Promise.all([
          fetch(`/api/supervisor/students/${studentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        const detailData = await detailRes.json()
        const meData = await meRes.json()

        if (!detailRes.ok) {
          throw new Error(detailData?.error || "Failed to load student details")
        }

        if (!meRes.ok) {
          throw new Error(meData?.error || "Failed to load profile")
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

        setDetail(detailData as ApiStudentDetail)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load student profile.")
      } finally {
        setLoading(false)
      }
    }

    if (studentId) {
      void fetchData()
    } else {
      setLoading(false)
      setError("Student ID missing from route.")
    }
  }, [studentId])

  const milestones = detail?.project?.milestones || []
  const sortedMilestones = useMemo(
    () =>
      [...milestones].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ),
    [milestones]
  )

  if (loading) {
    return (
      <DashboardShell user={shellUser} role="supervisor" title="Student Details">
        <div className="p-6">Loading student details...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="supervisor" title="Student Details">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/supervisor/students">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to students
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/dashboard/messages?userId=${detail.student.id}&name=${encodeURIComponent(
                    detail.student.fullName || "Student"
                  )}`}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message student
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/dashboard/meetings?userId=${detail.student.id}&name=${encodeURIComponent(
                    detail.student.fullName || "Student"
                  )}`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule meeting
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/supervisor/feedback">
                  Leave feedback
                </Link>
              </Button>
            </div>

            <Card>
              <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <Avatar className="h-14 w-14 shrink-0">
                    <AvatarImage src="/placeholder.svg" alt={detail.student.fullName || "Student"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(detail.student.fullName || "Student")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <h2 className="truncate text-xl font-semibold">
                      {detail.student.fullName || "Unnamed Student"}
                    </h2>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {detail.student.email}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {splitCsv(detail.student.skills).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold tabular-nums">
                      {detail.progress}%
                    </span>
                  </div>
                  <Progress value={detail.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {detail.completedMilestones}/{detail.totalMilestones} milestones completed
                    {detail.delayedMilestones > 0
                      ? ` · ${detail.delayedMilestones} delayed`
                      : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FolderKanban className="h-4 w-4 text-primary" />
                    Project Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.project ? (
                    <>
                      <p className="font-semibold">{detail.project.title || "Untitled Project"}</p>
                      <p className="text-sm text-muted-foreground">
                        {detail.project.description || "No project description provided yet."}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {splitCsv(detail.project.keywords).map((keyword) => (
                          <Badge key={keyword} variant="outline" className="text-[10px]">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No project linked yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Next Milestone</CardTitle>
                </CardHeader>
                <CardContent>
                  {detail.nextMilestone ? (
                    <div className="space-y-2">
                      <p className="font-medium">{detail.nextMilestone.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(detail.nextMilestone.dueDate)}
                      </p>
                      <Badge variant="outline" className="capitalize">
                        {detail.nextMilestone.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming milestone.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Milestone Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedMilestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones available yet.</p>
                ) : (
                  sortedMilestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium">{milestone.title}</p>
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {formatDate(milestone.dueDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {milestone.status.replace("_", " ")}
                          </Badge>
                          {milestone.isCriticalPath && (
                            <Badge
                              variant="outline"
                              className="border-warning/30 text-warning"
                            >
                              <Lock className="mr-1 h-3 w-3" />
                              Critical
                            </Badge>
                          )}
                        </div>
                      </div>
                      {milestone.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {milestone.description}
                        </p>
                      )}
                      {milestone.feedback && (
                        <div className="mt-2 rounded-md bg-muted/40 p-2 text-sm">
                          <span className="font-medium">Feedback:</span>{" "}
                          {milestone.feedback}
                        </div>
                      )}
                      {milestone.completedDate && (
                        <p className="mt-2 text-xs text-success">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          Completed {formatDate(milestone.completedDate)}
                        </p>
                      )}
                      {!milestone.completedDate && milestone.status === "delayed" && (
                        <p className="mt-2 text-xs text-warning">
                          <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                          Delayed milestone, review recommended
                        </p>
                      )}
                      {!milestone.completedDate && milestone.status !== "delayed" && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                          In progress timeline
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
