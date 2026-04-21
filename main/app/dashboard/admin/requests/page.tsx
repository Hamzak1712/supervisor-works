"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@/types"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react"

type RequestItem = {
  id: string
  status: string
  message: string | null
  createdAt: string
  respondedAt: string | null
  responseMessage: string | null
  ageDays: number
  isEscalated: boolean
  isStale: boolean
  student: {
    id: string
    email: string
    fullName: string
  }
  supervisor: {
    id: string
    email: string
    status: "ACTIVE" | "SUSPENDED" | "PENDING"
    fullName: string
  }
  project: {
    id: string
    title: string
    status: string
    academicPeriod: {
      id: string
      name: string
    } | null
  } | null
}

type OversightPayload = {
  config: {
    id: string
    slaDays: number
    staleExpireDays: number
  }
  summary: {
    totalRequests: number
    escalatedPending: number
    stalePending: number
    statusCounts: {
      pending: number
      accepted: number
      declined: number
      withdrawn: number
      expired: number
      other: number
    }
  }
  escalationQueue: RequestItem[]
  requests: RequestItem[]
  generatedAt: string
  actionResult?: {
    expiredCount?: number
    thresholdDays?: number
    requestId?: string
    decision?: string
  }
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function statusTone(status: string) {
  if (status === "accepted") return "bg-emerald-500/10 text-emerald-600"
  if (status === "declined") return "bg-red-500/10 text-red-600"
  if (status === "withdrawn") return "bg-zinc-500/10 text-zinc-600"
  if (status === "expired") return "bg-amber-500/10 text-amber-700"
  return "bg-blue-500/10 text-blue-700"
}

function orderedStatuses(requests: RequestItem[]) {
  const preferred = ["pending", "accepted", "declined", "withdrawn", "expired"]
  const discovered = Array.from(new Set(requests.map((item) => item.status)))
  const extras = discovered.filter((status) => !preferred.includes(status)).sort()
  return [...preferred.filter((status) => discovered.includes(status)), ...extras]
}

export default function AdminRequestsPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [payload, setPayload] = useState<OversightPayload | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showEscalatedOnly, setShowEscalatedOnly] = useState(false)
  const [slaDaysDraft, setSlaDaysDraft] = useState("7")
  const [staleDaysDraft, setStaleDaysDraft] = useState("14")

  function authHeaders() {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  function hydrate(data: OversightPayload) {
    setPayload(data)
    setSlaDaysDraft(String(data.config.slaDays))
    setStaleDaysDraft(String(data.config.staleExpireDays))
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, requestsRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/requests", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const requestsData = (await requestsRes.json()) as
        | OversightPayload
        | { error?: string }

      if (!requestsRes.ok || !("requests" in requestsData)) {
        throw new Error(
          (requestsData as { error?: string })?.error ||
            "Failed to load request oversight"
        )
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

      hydrate(requestsData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load request oversight.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(body: Record<string, unknown>, successNotice: string) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/requests", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as OversightPayload | { error?: string }

      if (!res.ok || !("requests" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)

      if (body.action === "force_expire_stale") {
        const count = data.actionResult?.expiredCount || 0
        const thresholdDays = data.actionResult?.thresholdDays || staleDaysDraft
        setNotice(`Force-expire completed: ${count} request(s) expired (threshold ${thresholdDays} day(s)).`)
      } else {
        setNotice(successNotice)
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
    }, 8000)

    return () => window.clearInterval(intervalId)
  }, [])

  const statusOptions = useMemo(() => {
    if (!payload) return ["pending", "accepted", "declined", "withdrawn", "expired"]
    return orderedStatuses(payload.requests)
  }, [payload])

  const filteredRequests = useMemo(() => {
    if (!payload) return []

    const q = search.trim().toLowerCase()

    return payload.requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      if (showEscalatedOnly && !item.isEscalated) return false
      if (!q) return true

      return (
        item.student.fullName.toLowerCase().includes(q) ||
        item.student.email.toLowerCase().includes(q) ||
        item.supervisor.fullName.toLowerCase().includes(q) ||
        item.supervisor.email.toLowerCase().includes(q) ||
        (item.project?.title || "").toLowerCase().includes(q)
      )
    })
  }, [payload, search, statusFilter, showEscalatedOnly])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Request Oversight">
        <div className="p-6">Loading request oversight...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Request Oversight">
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
          <MetricCard
            icon={ShieldCheck}
            label="Total Requests"
            value={String(payload.summary.totalRequests)}
          />
          <MetricCard
            icon={Clock3}
            label="Pending"
            value={String(payload.summary.statusCounts.pending)}
          />
          <MetricCard
            icon={ShieldAlert}
            label="Escalated Queue"
            value={String(payload.summary.escalatedPending)}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Stale Pending"
            value={String(payload.summary.stalePending)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Oversight Controls</CardTitle>
              <CardDescription>
                Configure SLA and stale expiry thresholds for request escalation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slaDays">Escalation SLA (days)</Label>
                <Input
                  id="slaDays"
                  type="number"
                  min={1}
                  value={slaDaysDraft}
                  onChange={(e) => setSlaDaysDraft(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staleDays">Stale Expiry Threshold (days)</Label>
                <Input
                  id="staleDays"
                  type="number"
                  min={1}
                  value={staleDaysDraft}
                  onChange={(e) => setStaleDaysDraft(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() =>
                    runAction(
                      {
                        action: "update_config",
                        slaDays: Number(slaDaysDraft),
                        staleExpireDays: Number(staleDaysDraft),
                      },
                      "Oversight settings updated."
                    )
                  }
                  disabled={busy}
                >
                  Save Oversight Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(
                      {
                        action: "force_expire_stale",
                        thresholdDays: Number(staleDaysDraft),
                      },
                      "Stale requests expired."
                    )
                  }
                  disabled={busy}
                >
                  Force-Expire Stale Requests
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Escalation Queue</CardTitle>
              <CardDescription>
                Pending requests older than {payload.config.slaDays} day(s).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload.escalationQueue.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No requests are currently beyond SLA.
                </div>
              ) : (
                payload.escalationQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.student.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          Supervisor: {item.supervisor.fullName}
                        </p>
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-700">
                        {item.ageDays} day(s) old
                      </Badge>
                    </div>

                    {item.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            runAction(
                              {
                                action: "manual_decision",
                                requestId: item.id,
                                decision: "accepted",
                              },
                              "Request accepted by admin."
                            )
                          }
                          disabled={busy}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Accept on behalf
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            runAction(
                              {
                                action: "manual_decision",
                                requestId: item.id,
                                decision: "declined",
                              },
                              "Request declined by admin."
                            )
                          }
                          disabled={busy}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline on behalf
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Supervision Requests</CardTitle>
            <CardDescription>
              View pending, accepted, declined, withdrawn, and expired requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search student, supervisor, or project"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={showEscalatedOnly ? "default" : "outline"}
                onClick={() => setShowEscalatedOnly((prev) => !prev)}
              >
                {showEscalatedOnly ? "Showing escalated only" : "Show escalated only"}
              </Button>
            </div>

            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  No requests match your current filters.
                </div>
              ) : (
                filteredRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.student.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.student.email} • Supervisor: {item.supervisor.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Project: {item.project?.title || "No linked project"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusTone(item.status)}>{item.status}</Badge>
                        {item.isEscalated && (
                          <Badge className="bg-amber-500/10 text-amber-700">Escalated</Badge>
                        )}
                        {item.isStale && (
                          <Badge className="bg-red-500/10 text-red-600">Stale</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      Created {formatDate(item.createdAt)} ({item.ageDays} day(s) ago)
                      {item.respondedAt && ` • Responded ${formatDate(item.respondedAt)}`}
                    </div>

                    {item.message && (
                      <p className="mt-2 text-sm">
                        <span className="font-medium">Student message:</span> {item.message}
                      </p>
                    )}

                    {item.responseMessage && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium">Response note:</span> {item.responseMessage}
                      </p>
                    )}

                    {item.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            runAction(
                              {
                                action: "manual_decision",
                                requestId: item.id,
                                decision: "accepted",
                              },
                              "Request accepted by admin."
                            )
                          }
                          disabled={busy}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Accept on behalf
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            runAction(
                              {
                                action: "manual_decision",
                                requestId: item.id,
                                decision: "declined",
                              },
                              "Request declined by admin."
                            )
                          }
                          disabled={busy}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline on behalf
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
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
