"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Download, RefreshCw, TrendingUp, Users, Activity, CalendarClock } from "lucide-react"
import type { User } from "@/types"

type ReportsPayload = {
  range: {
    from: string
    to: string
  }
  matching: {
    studentsWithRequests: number
    matchedWithin7Days: number
    matchedWithin7DaysRate: number
    averageRequestsPerStudent: number
    declineRate: number
    totalRequests: number
    accepted: number
    declined: number
    pendingOrOther: number
  }
  supervisorWorkload: {
    totalSupervisors: number
    overloaded: number
    underLoaded: number
    averageStudentsPerSupervisor: number
    rows: Array<{
      supervisorId: string
      supervisorName: string
      assignedStudents: number
      maxCapacity: number
      utilizationPercent: number
      isOverloaded: boolean
      isUnderLoaded: boolean
      avgResponseDays: number | null
      responseSlaBreached: boolean
    }>
  }
  projectHealth: {
    totals: {
      atRisk: number
      onTrack: number
      completed: number
    }
    rows: Array<{
      periodName: string
      atRisk: number
      onTrack: number
      completed: number
    }>
  }
  rescheduling: {
    totalShifts: number
    averageShiftDays: number
    averageMilestonesTouched: number
    rows: Array<{
      periodName: string
      shifts: number
      averageShiftDays: number
      averageMilestonesTouched: number
    }>
  }
  engagement: {
    activeUsers: number
    averageDau: number
    mau: number
    dauMauRatio: number
    dailyActivity: Array<{
      date: string
      activeUsers: number
    }>
    featureUsage: Array<{
      feature: string
      count: number
    }>
  }
  generatedAt: string
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function toDateInput(value: string) {
  return value.slice(0, 10)
}

function startDateDefault() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return toDateInput(date.toISOString())
}

function endDateDefault() {
  return toDateInput(new Date().toISOString())
}

export default function AdminReportsPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [payload, setPayload] = useState<ReportsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const [fromDate, setFromDate] = useState(startDateDefault())
  const [toDate, setToDate] = useState(endDateDefault())

  const authHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  async function fetchReports(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setBusy(true)
      setError("")
      const token = localStorage.getItem("token")
      const qs = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`

      const [meRes, reportRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/reports${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const meData = await meRes.json()
      const reportData = (await reportRes.json()) as ReportsPayload | { error?: string }

      if (!reportRes.ok || !("matching" in reportData)) {
        throw new Error((reportData as { error?: string })?.error || "Failed to load reports")
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

      setPayload(reportData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load reports.")
    } finally {
      setBusy(false)
      if (showLoading) setLoading(false)
    }
  }

  async function downloadReport(format: "csv" | "json") {
    try {
      setBusy(true)
      setError("")
      const qs = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(
        toDate
      )}&export=${format}`
      const res = await fetch(`/api/admin/reports${qs}`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        let message = "Export failed"
        try {
          const data = await res.json()
          message = data?.error || message
        } catch {}
        throw new Error(message)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `analytics-report.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not export report.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchReports(true)
  }, [])

  const topWorkloadRows = useMemo(() => {
    if (!payload) return []
    return payload.supervisorWorkload.rows.slice(0, 8)
  }, [payload])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Reporting & Analytics">
        <div className="p-6">Loading analytics reports...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Reporting & Analytics">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Reporting & Analytics</h2>
            <p className="text-sm text-muted-foreground">
              Matching success, workload, project health, rescheduling, and engagement insights.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:flex">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => void fetchReports()} disabled={busy}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Apply
              </Button>
              <Button variant="outline" onClick={() => void downloadReport("csv")} disabled={busy}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => void downloadReport("json")} disabled={busy}>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Matched Within 7 Days"
            value={`${payload.matching.matchedWithin7DaysRate}%`}
            hint={`${payload.matching.matchedWithin7Days} of ${payload.matching.studentsWithRequests} students`}
          />
          <MetricCard
            icon={Users}
            label="Avg Requests / Student"
            value={`${payload.matching.averageRequestsPerStudent}`}
            hint={`${payload.matching.totalRequests} total requests`}
          />
          <MetricCard
            icon={Activity}
            label="Decline Rate"
            value={`${payload.matching.declineRate}%`}
            hint={`${payload.matching.declined} declined`}
          />
          <MetricCard
            icon={CalendarClock}
            label="Reschedule Avg Shift"
            value={`${payload.rescheduling.averageShiftDays} days`}
            hint={`${payload.rescheduling.totalShifts} shifts`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Supervisor Workload</CardTitle>
              <CardDescription>
                Overloaded: {payload.supervisorWorkload.overloaded} • Under-loaded:{" "}
                {payload.supervisorWorkload.underLoaded}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topWorkloadRows.map((row) => (
                <div key={row.supervisorId} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{row.supervisorName}</p>
                    <div className="flex items-center gap-2">
                      {row.isOverloaded && <Badge variant="destructive">Overloaded</Badge>}
                      {row.isUnderLoaded && <Badge variant="outline">Under-loaded</Badge>}
                      {row.responseSlaBreached && <Badge variant="outline">SLA &gt; 7d</Badge>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.assignedStudents}/{row.maxCapacity} students • {row.utilizationPercent}% utilization • Avg
                    response {row.avgResponseDays ?? "n/a"} days
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Health by Period</CardTitle>
              <CardDescription>
                At risk: {payload.projectHealth.totals.atRisk} • On track: {payload.projectHealth.totals.onTrack} •
                Completed: {payload.projectHealth.totals.completed}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {payload.projectHealth.rows.map((row) => (
                <div key={row.periodName} className="rounded-lg border p-3">
                  <p className="font-medium">{row.periodName}</p>
                  <p className="text-xs text-muted-foreground">
                    At-risk {row.atRisk} • On-track {row.onTrack} • Completed {row.completed}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rescheduling Frequency</CardTitle>
              <CardDescription>
                Avg milestones touched: {payload.rescheduling.averageMilestonesTouched}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {payload.rescheduling.rows.map((row) => (
                <div key={row.periodName} className="rounded-lg border p-3">
                  <p className="font-medium">{row.periodName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.shifts} shifts • Avg shift {row.averageShiftDays} days • Avg milestones touched{" "}
                    {row.averageMilestonesTouched}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
              <CardDescription>
                DAU: {payload.engagement.averageDau} • MAU: {payload.engagement.mau} • DAU/MAU:{" "}
                {payload.engagement.dauMauRatio}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {payload.engagement.featureUsage.map((usage) => (
                  <div key={usage.feature} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{usage.feature.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold">{usage.count}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Generated at {new Date(payload.generatedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}
