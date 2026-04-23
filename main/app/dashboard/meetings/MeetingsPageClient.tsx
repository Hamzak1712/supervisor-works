"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Calendar,
  Save,
  Pencil,
  Trash2,
  PlusCircle,
  UserRound,
  Clock3,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { User, UserRole } from "@/types"

type MeetingPerson = {
  id: string
  email: string
  name: string
}

type Meeting = {
  id: string
  organizerId: string
  attendeeId: string
  title: string
  description: string | null
  scheduledAt: string
  createdAt: string
  organizer: MeetingPerson
  attendee: MeetingPerson
}

type ApiMeUser = {
  id: string
  email: string
  role: string
  createdAt: string
  studentProfile?: {
    fullName?: string | null
  } | null
  supervisorProfile?: {
    fullName?: string | null
  } | null
}

const fallbackUser: User = {
  id: "user",
  email: "user@example.com",
  name: "User",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

function normalizeRole(role: string | null | undefined): UserRole {
  const value = (role || "").toLowerCase()
  if (value === "supervisor") return "supervisor"
  if (value === "admin") return "admin"
  return "student"
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function MeetingsPageClient() {
  const searchParams = useSearchParams()
  const otherUserId = searchParams.get("userId") || ""
  const otherUserName = searchParams.get("name") || "Meetings"

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [title, setTitle] = useState("Project Meeting")
  const [description, setDescription] = useState("")
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  )
  const [editingMeetingId, setEditingMeetingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all")
  const [currentRole, setCurrentRole] = useState<UserRole>("student")
  const [shellUser, setShellUser] = useState<User>(fallbackUser)
  const [currentUserId, setCurrentUserId] = useState("")

  useEffect(() => {
    async function bootstrapUser() {
      try {
        const token = localStorage.getItem("token")
        const storedRole = normalizeRole(
          localStorage.getItem("userRole") || localStorage.getItem("role")
        )
        const storedEmail = localStorage.getItem("userEmail") || fallbackUser.email

        setCurrentRole(storedRole)
        setShellUser({
          ...fallbackUser,
          role: storedRole,
          email: storedEmail,
          name: storedRole === "supervisor" ? "Supervisor" : "Student",
        })

        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()
        if (!res.ok || !data?.user) return

        const meUser = data.user as ApiMeUser
        const normalizedRole = normalizeRole(meUser.role)
        const fullName =
          meUser.studentProfile?.fullName ||
          meUser.supervisorProfile?.fullName ||
          meUser.email?.split("@")[0] ||
          "User"

        setCurrentUserId(meUser.id || "")
        setCurrentRole(normalizedRole)
        setShellUser({
          id: meUser.id || fallbackUser.id,
          email: meUser.email || fallbackUser.email,
          name: fullName,
          role: normalizedRole,
          createdAt:
            typeof meUser.createdAt === "string"
              ? meUser.createdAt
              : fallbackUser.createdAt,
          avatarUrl: "/placeholder.svg",
        })
      } catch (err) {
        console.error(err)
      }
    }

    void bootstrapUser()
  }, [])

  useEffect(() => {
    async function fetchMeetings() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const url = otherUserId
          ? `/api/meetings?userId=${otherUserId}`
          : "/api/meetings"

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load meetings")
        }

        setMeetings(data.meetings || [])
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load meetings.")
      } finally {
        setLoading(false)
      }
    }

    void fetchMeetings()
  }, [otherUserId])

  const now = Date.now()

  const upcomingMeetings = useMemo(
    () =>
      [...meetings]
        .filter((meeting) => new Date(meeting.scheduledAt).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ),
    [meetings, now]
  )

  const pastMeetings = useMemo(
    () =>
      [...meetings]
        .filter((meeting) => new Date(meeting.scheduledAt).getTime() < now)
        .sort(
          (a, b) =>
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        ),
    [meetings, now]
  )

  const filteredMeetings = useMemo(() => {
    if (filter === "upcoming") return upcomingMeetings
    if (filter === "past") return pastMeetings
    return [...upcomingMeetings, ...pastMeetings]
  }, [filter, upcomingMeetings, pastMeetings])

  function resetForm() {
    setEditingMeetingId("")
    setTitle("Project Meeting")
    setDescription("")
    setScheduledAt(toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)))
  }

  function startEdit(meeting: Meeting) {
    setEditingMeetingId(meeting.id)
    setTitle(meeting.title)
    setDescription(meeting.description || "")
    setScheduledAt(toDatetimeLocalValue(new Date(meeting.scheduledAt)))
  }

  async function saveMeeting() {
    try {
      if (!title.trim()) {
        setError("Meeting title is required.")
        return
      }

      if (!scheduledAt) {
        setError("Meeting time is required.")
        return
      }

      if (!editingMeetingId && !otherUserId) {
        setError("Open meetings from a student/supervisor card to schedule one.")
        return
      }

      setError("")
      setSaving(true)
      const token = localStorage.getItem("token")

      if (editingMeetingId) {
        const res = await fetch(`/api/meetings/${editingMeetingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description,
            scheduledAt: new Date(scheduledAt).toISOString(),
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update meeting")
        }

        setMeetings((prev) =>
          prev.map((meeting) =>
            meeting.id === editingMeetingId ? data.meeting : meeting
          )
        )
        resetForm()
        return
      }

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attendeeId: otherUserId,
          title: title.trim(),
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create meeting")
      }

      setMeetings((prev) => [...prev, data.meeting])
      setDescription("")
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not save meeting.")
    } finally {
      setSaving(false)
    }
  }

  async function cancelMeeting(meeting: Meeting) {
    try {
      const confirmed = window.confirm(
        `Cancel "${meeting.title}" scheduled on ${formatDateTime(meeting.scheduledAt)}?`
      )
      if (!confirmed) return

      setError("")
      setDeletingId(meeting.id)
      const token = localStorage.getItem("token")

      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to cancel meeting")
      }

      setMeetings((prev) => prev.filter((item) => item.id !== meeting.id))
      if (editingMeetingId === meeting.id) {
        resetForm()
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not cancel meeting.")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <DashboardShell user={shellUser} role={currentRole} title="Meetings">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-4 w-4 text-primary" />
              {otherUserId ? `Meetings with ${otherUserName}` : "Meeting Planner"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda / notes..."
              rows={4}
            />
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveMeeting} disabled={saving}>
                {editingMeetingId ? (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Updating..." : "Update Meeting"}
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {saving ? "Scheduling..." : "Schedule Meeting"}
                  </>
                )}
              </Button>
              {editingMeetingId && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
            </div>
            {!otherUserId && !editingMeetingId && (
              <p className="text-xs text-muted-foreground">
                Tip: open this page from a student/supervisor card to schedule with a
                specific person.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Meeting History</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{upcomingMeetings.length} upcoming</Badge>
              <Badge variant="outline">{pastMeetings.length} past</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "upcoming" ? "default" : "outline"}
                onClick={() => setFilter("upcoming")}
              >
                Upcoming
              </Button>
              <Button
                size="sm"
                variant={filter === "past" ? "default" : "outline"}
                onClick={() => setFilter("past")}
              >
                Past
              </Button>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading meetings...</div>
            ) : filteredMeetings.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No meetings in this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMeetings.map((meeting) => {
                  const isOrganizer = meeting.organizerId === currentUserId
                  const counterpart = isOrganizer ? meeting.attendee : meeting.organizer
                  const isPast = new Date(meeting.scheduledAt).getTime() < now

                  return (
                    <div
                      key={meeting.id}
                      className={cn(
                        "rounded-lg border p-4",
                        isPast ? "bg-muted/20" : "bg-background"
                      )}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{meeting.title}</p>
                            <Badge variant={isPast ? "outline" : "secondary"}>
                              {isPast ? "Past" : "Upcoming"}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {isOrganizer ? "Organizer" : "Attendee"}
                            </Badge>
                          </div>
                          <p className="flex items-center gap-1 text-sm text-muted-foreground">
                            <UserRound className="h-3.5 w-3.5" />
                            With {counterpart.name}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDateTime(meeting.scheduledAt)}
                          </p>
                          {meeting.description && (
                            <p className="pt-1 text-sm text-muted-foreground">
                              {meeting.description}
                            </p>
                          )}
                        </div>

                        {isOrganizer && (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(meeting)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            {!isPast && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelMeeting(meeting)}
                                disabled={deletingId === meeting.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingId === meeting.id ? "Cancelling..." : "Cancel"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
