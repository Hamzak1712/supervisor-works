"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { User } from "@/types"
import { Megaphone, Mail, Clock3, AlertTriangle, ShieldAlert } from "lucide-react"

type AnnouncementItem = {
  id: string
  title: string
  body: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  audience: "ALL" | "STUDENTS" | "SUPERVISORS" | "YEAR_GROUP"
  audienceYearGroup: string | null
  startsAt: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  lifecycle: "scheduled" | "active" | "expired"
  createdByEmail: string
}

type TemplateItem = {
  id: string
  key: string
  name: string
  subject: string
  body: string
  updatedAt: string
}

type CommunicationsPayload = {
  announcements: AnnouncementItem[]
  templates: TemplateItem[]
  audienceSummary: {
    totalUsers: number
    students: number
    supervisors: number
    studentsWithoutSupervisor: number
  }
  yearGroups: string[]
  actionResult?: {
    sentCount?: number
    audience?: string
  }
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const tzOffset = date.getTimezoneOffset() * 60_000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 16)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function AdminCommunicationsPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [payload, setPayload] = useState<CommunicationsPayload | null>(null)

  const [announcementTitle, setAnnouncementTitle] = useState("")
  const [announcementBody, setAnnouncementBody] = useState("")
  const [announcementSeverity, setAnnouncementSeverity] = useState("INFO")
  const [announcementAudience, setAnnouncementAudience] = useState("ALL")
  const [announcementYearGroup, setAnnouncementYearGroup] = useState("")
  const [announcementStartsAt, setAnnouncementStartsAt] = useState("")
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState("")

  const [selectedTemplateKey, setSelectedTemplateKey] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")

  const [broadcastAudience, setBroadcastAudience] = useState("students_without_supervisor")
  const [broadcastYearGroup, setBroadcastYearGroup] = useState("")
  const [broadcastSubject, setBroadcastSubject] = useState("Message from administrator")
  const [broadcastBody, setBroadcastBody] = useState("")

  function authHeaders() {
    const token = localStorage.getItem("token")
    return { Authorization: `Bearer ${token}` }
  }

  function hydrate(data: CommunicationsPayload) {
    setPayload(data)

    if (!selectedTemplateKey && data.templates.length > 0) {
      const first = data.templates[0]
      setSelectedTemplateKey(first.key)
      setTemplateSubject(first.subject)
      setTemplateBody(first.body)
    } else if (selectedTemplateKey) {
      const selected = data.templates.find((template) => template.key === selectedTemplateKey)
      if (selected) {
        setTemplateSubject(selected.subject)
        setTemplateBody(selected.body)
      }
    }
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, commsRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/communications", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const commsData = (await commsRes.json()) as CommunicationsPayload | { error?: string }

      if (!commsRes.ok || !("announcements" in commsData)) {
        throw new Error((commsData as { error?: string })?.error || "Failed to load communications")
      }

      if (meRes.ok) {
        const meUser = meData.user
        setShellUser({
          id: meUser?.id || fallbackShellUser.id,
          email: meUser?.email || fallbackShellUser.email,
          name: meUser?.email?.split("@")?.[0] || fallbackShellUser.name,
          role: "admin",
          createdAt:
            typeof meUser?.createdAt === "string"
              ? meUser.createdAt
              : fallbackShellUser.createdAt,
          avatarUrl: "/placeholder.svg",
        })
      }

      hydrate(commsData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load communications data.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(
    body: Record<string, unknown>,
    successNotice: string,
    options?: { clearAnnouncement?: boolean; clearBroadcast?: boolean }
  ) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/communications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as CommunicationsPayload | { error?: string }
      if (!res.ok || !("announcements" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)

      if (body.action === "broadcast_email") {
        const sentCount = data.actionResult?.sentCount || 0
        setNotice(`Broadcast sent to ${sentCount} user(s).`)
      } else {
        setNotice(successNotice)
      }

      if (options?.clearAnnouncement) {
        setAnnouncementTitle("")
        setAnnouncementBody("")
        setAnnouncementSeverity("INFO")
        setAnnouncementAudience("ALL")
        setAnnouncementYearGroup("")
        setAnnouncementStartsAt("")
        setAnnouncementExpiresAt("")
      }

      if (options?.clearBroadcast) {
        setBroadcastBody("")
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchData(true)
    const intervalId = window.setInterval(() => {
      void fetchData()
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [])

  const selectedTemplate = useMemo(() => {
    if (!payload) return null
    return payload.templates.find((template) => template.key === selectedTemplateKey) || null
  }, [payload, selectedTemplateKey])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Announcements & Communication">
        <div className="p-6">Loading communication controls...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Announcements & Communication">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        {notice && (
          <Card className="border-emerald-500/30">
            <CardContent className="p-4 text-sm text-emerald-600">{notice}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Megaphone} label="Active users" value={String(payload.audienceSummary.totalUsers)} />
          <MetricCard icon={Mail} label="Students" value={String(payload.audienceSummary.students)} />
          <MetricCard icon={ShieldAlert} label="Supervisors" value={String(payload.audienceSummary.supervisors)} />
          <MetricCard
            icon={AlertTriangle}
            label="Students w/o supervisor"
            value={String(payload.audienceSummary.studentsWithoutSupervisor)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Publish or Schedule Announcement Banner</CardTitle>
              <CardDescription>
                Announcements appear on dashboard headers based on audience and schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Proposal deadline reminder"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-body">Message</Label>
                <Textarea
                  id="announcement-body"
                  rows={3}
                  value={announcementBody}
                  onChange={(e) => setAnnouncementBody(e.target.value)}
                  placeholder="Submit your proposal before Friday at 17:00."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={announcementSeverity} onValueChange={setAnnouncementSeverity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={announcementAudience} onValueChange={setAnnouncementAudience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All users</SelectItem>
                      <SelectItem value="STUDENTS">Students</SelectItem>
                      <SelectItem value="SUPERVISORS">Supervisors</SelectItem>
                      <SelectItem value="YEAR_GROUP">Specific year group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {announcementAudience === "YEAR_GROUP" && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Year group (Academic Period name)</Label>
                    <Input
                      value={announcementYearGroup}
                      onChange={(e) => setAnnouncementYearGroup(e.target.value)}
                      placeholder={payload.yearGroups[0] || "2025/26"}
                      list="year-groups-list"
                    />
                    <datalist id="year-groups-list">
                      {payload.yearGroups.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Starts at (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={announcementStartsAt}
                    onChange={(e) => setAnnouncementStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expires at (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={announcementExpiresAt}
                    onChange={(e) => setAnnouncementExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              <Button
                disabled={busy || !announcementTitle.trim() || !announcementBody.trim()}
                onClick={() =>
                  runAction(
                    {
                      action: "create_announcement",
                      title: announcementTitle,
                      message: announcementBody,
                      severity: announcementSeverity,
                      audience: announcementAudience,
                      audienceYearGroup: announcementYearGroup,
                      startsAt: announcementStartsAt || undefined,
                      expiresAt: announcementExpiresAt || undefined,
                    },
                    "Announcement saved.",
                    { clearAnnouncement: true }
                  )
                }
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Publish / Schedule
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Broadcast Email</CardTitle>
              <CardDescription>
                Send a bulk message to filtered audiences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={broadcastAudience} onValueChange={setBroadcastAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active users</SelectItem>
                    <SelectItem value="students">All students</SelectItem>
                    <SelectItem value="supervisors">All supervisors</SelectItem>
                    <SelectItem value="students_without_supervisor">
                      Students without assigned supervisor
                    </SelectItem>
                    <SelectItem value="year_group">Specific year group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {broadcastAudience === "year_group" && (
                <div className="space-y-2">
                  <Label>Year group (Academic Period name)</Label>
                  <Input
                    value={broadcastYearGroup}
                    onChange={(e) => setBroadcastYearGroup(e.target.value)}
                    placeholder={payload.yearGroups[0] || "2025/26"}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="Message from administrator"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Please review your dashboard for important updates."
                />
              </div>
              <Button
                disabled={busy || !broadcastSubject.trim() || !broadcastBody.trim()}
                onClick={() =>
                  runAction(
                    {
                      action: "broadcast_email",
                      audience: broadcastAudience,
                      yearGroup: broadcastYearGroup,
                      subject: broadcastSubject,
                      message: broadcastBody,
                    },
                    "Broadcast sent.",
                    { clearBroadcast: true }
                  )
                }
              >
                <Mail className="mr-2 h-4 w-4" />
                Send Broadcast
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email Template Manager</CardTitle>
            <CardDescription>
              Edit transactional email copy for core system flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={selectedTemplateKey}
                  onValueChange={(value) => {
                    setSelectedTemplateKey(value)
                    const selected = payload.templates.find((item) => item.key === value)
                    if (selected) {
                      setTemplateSubject(selected.subject)
                      setTemplateBody(selected.body)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose template" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload.templates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Subject</Label>
                <Input
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                rows={5}
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedTemplate ? `Last updated: ${formatDate(selectedTemplate.updatedAt)}` : "No template selected"}
              </p>
              <Button
                disabled={busy || !selectedTemplateKey || !templateSubject.trim() || !templateBody.trim()}
                onClick={() =>
                  runAction(
                    {
                      action: "update_template",
                      key: selectedTemplateKey,
                      subject: templateSubject,
                      body: templateBody,
                    },
                    "Template updated."
                  )
                }
              >
                Save Template
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcement History</CardTitle>
            <CardDescription>
              Includes active, scheduled, and expired announcements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.announcements.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No announcements yet.
              </div>
            ) : (
              payload.announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{announcement.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {announcement.audience}
                        {announcement.audienceYearGroup
                          ? ` (${announcement.audienceYearGroup})`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          announcement.severity === "CRITICAL"
                            ? "bg-red-500/10 text-red-600"
                            : announcement.severity === "WARNING"
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-blue-500/10 text-blue-700"
                        }
                      >
                        {announcement.severity}
                      </Badge>
                      <Badge variant="outline" className="uppercase">
                        {announcement.lifecycle}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{announcement.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Starts {formatDate(announcement.startsAt)}
                    </span>
                    {announcement.expiresAt && <span>Expires {formatDate(announcement.expiresAt)}</span>}
                    <span>By {announcement.createdByEmail}</span>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          {
                            action: "delete_announcement",
                            announcementId: announcement.id,
                          },
                          "Announcement deleted."
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}
