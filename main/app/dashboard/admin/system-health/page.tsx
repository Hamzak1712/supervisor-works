"use client"

import { useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { currentAdmin, mockSystemHealth } from "@/lib/mock-data"
import {
  Activity,
  Server,
  Database,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  CheckCircle2,
  Bell,
  Cpu,
  HardDrive,
  RefreshCw,
  Download,
  LineChart,
  Wifi,
  Zap,
  Calendar,
  Terminal,
  ScrollText,
  XCircle,
  Play,
} from "lucide-react"

type Status = "operational" | "degraded" | "down"

interface ExtendedService {
  service: string
  status: Status
  lastChecked: string
  uptime: number
  responseMs: number
  requestsPerMin: number
  errorRate: number
}

interface IncidentEntry {
  id: string
  title: string
  service: string
  severity: "low" | "medium" | "high"
  status: "resolved" | "investigating" | "monitoring"
  startedAt: string
  duration: string
  description: string
}

function getServiceIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes("database")) return Database
  if (n.includes("authentication")) return ShieldCheck
  if (n.includes("storage")) return HardDrive
  if (n.includes("engine") || n.includes("matching")) return Cpu
  if (n.includes("notification")) return Bell
  return Server
}

export default function AdminSystemHealthPage() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  const services: ExtendedService[] = useMemo(
    () =>
      mockSystemHealth.map((s, i) => ({
        ...s,
        responseMs: [42, 18, 156, 287, 31][i] ?? 50,
        requestsPerMin: [1240, 3450, 890, 430, 2100][i] ?? 500,
        errorRate: s.status === "operational" ? 0.02 : s.status === "degraded" ? 1.4 : 100,
      })),
    [],
  )

  const incidents: IncidentEntry[] = [
    {
      id: "inc-001",
      title: "Notification service latency spike",
      service: "Notification Service",
      severity: "medium",
      status: "investigating",
      startedAt: "2024-12-20 08:12",
      duration: "Ongoing",
      description: "Email queue processing slower than normal. Team investigating SMTP provider.",
    },
    {
      id: "inc-002",
      title: "Database failover completed",
      service: "Database (PostgreSQL)",
      severity: "low",
      status: "resolved",
      startedAt: "2024-12-18 02:34",
      duration: "14 min",
      description: "Automatic failover to replica during scheduled patching. No data loss.",
    },
    {
      id: "inc-003",
      title: "AI matching engine queue backlog",
      service: "AI Matching Engine",
      severity: "high",
      status: "resolved",
      startedAt: "2024-12-15 17:01",
      duration: "1h 42m",
      description: "Burst of matching requests caused queue backlog. Scaled horizontally.",
    },
    {
      id: "inc-004",
      title: "Storage bucket region switch",
      service: "File Storage",
      severity: "low",
      status: "resolved",
      startedAt: "2024-12-10 11:20",
      duration: "8 min",
      description: "Planned maintenance to migrate assets to primary region.",
    },
  ]

  const maintenance = [
    {
      title: "Quarterly database vacuum",
      window: "Dec 28, 2024 - 02:00-04:00 UTC",
      impact: "Read-only mode during window",
    },
    {
      title: "Auth service dependency upgrade",
      window: "Jan 05, 2025 - 23:00-23:30 UTC",
      impact: "Brief login unavailability",
    },
  ]

  const stats = useMemo(() => {
    return {
      operational: services.filter((s) => s.status === "operational").length,
      degraded: services.filter((s) => s.status === "degraded").length,
      down: services.filter((s) => s.status === "down").length,
      avgUptime: services.reduce((a, b) => a + b.uptime, 0) / services.length,
      avgResponse: Math.round(services.reduce((a, b) => a + b.responseMs, 0) / services.length),
    }
  }, [services])

  function refresh() {
    setLastRefreshed(new Date())
  }

  return (
    <DashboardShell user={currentAdmin} role="admin" title="System Health">
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Service Status</h2>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring across {services.length} critical services - last refreshed{" "}
              {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="auto-refresh" className="text-sm">
                Auto-refresh
              </Label>
            </div>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export report
            </Button>
          </div>
        </div>

        {/* Overall banner */}
        <Card
          className={
            stats.down > 0
              ? "border-destructive/40 bg-destructive/5"
              : stats.degraded > 0
                ? "border-warning/40 bg-warning/5"
                : "border-success/40 bg-success/5"
          }
        >
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  stats.down > 0
                    ? "bg-destructive/15 text-destructive"
                    : stats.degraded > 0
                      ? "bg-warning/15 text-warning"
                      : "bg-success/15 text-success"
                }`}
              >
                {stats.down > 0 ? (
                  <XCircle className="h-6 w-6" />
                ) : stats.degraded > 0 ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {stats.down > 0
                    ? "Critical issues detected"
                    : stats.degraded > 0
                      ? "Degraded performance"
                      : "All systems operational"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {stats.operational} operational, {stats.degraded} degraded, {stats.down} down - avg uptime{" "}
                  {stats.avgUptime.toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-xs text-muted-foreground">Average response</p>
              <p className="text-2xl font-bold tabular-nums">{stats.avgResponse}ms</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Activity} label="Monitored" value={services.length.toString()} tone="primary" />
          <StatCard icon={CheckCircle2} label="Operational" value={stats.operational.toString()} tone="success" />
          <StatCard icon={AlertTriangle} label="Degraded" value={stats.degraded.toString()} tone="warning" />
          <StatCard icon={XCircle} label="Down" value={stats.down.toString()} tone="destructive" />
          <StatCard
            icon={Clock3}
            label="Avg Uptime"
            value={`${stats.avgUptime.toFixed(2)}%`}
            tone={stats.avgUptime >= 99.5 ? "success" : "warning"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="space-y-6 xl:col-span-3">
            {/* Service list */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  Live Service Status
                </CardTitle>
                <CardDescription>Detailed metrics for every monitored service</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {services.map((service) => {
                  const Icon = getServiceIcon(service.service)
                  const tone =
                    service.status === "operational"
                      ? "success"
                      : service.status === "degraded"
                        ? "warning"
                        : "destructive"
                  return (
                    <div key={service.service} className="rounded-xl border p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-${tone}/10 text-${tone}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{service.service}</h3>
                              <Badge
                                variant="outline"
                                className={
                                  tone === "success"
                                    ? "border-success/30 bg-success/10 text-success"
                                    : tone === "warning"
                                      ? "border-warning/30 bg-warning/10 text-warning"
                                      : "border-destructive/30 bg-destructive/10 text-destructive"
                                }
                              >
                                {service.status === "operational" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                {service.status === "degraded" && <AlertTriangle className="mr-1 h-3 w-3" />}
                                {service.status === "down" && <XCircle className="mr-1 h-3 w-3" />}
                                {service.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Last check {new Date(service.lastChecked).toLocaleTimeString()}
                              </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <MetricBlock
                                icon={Clock3}
                                label="Uptime"
                                value={`${service.uptime}%`}
                                progress={service.uptime}
                              />
                              <MetricBlock
                                icon={Zap}
                                label="Response"
                                value={`${service.responseMs}ms`}
                                hint={service.responseMs < 100 ? "Excellent" : service.responseMs < 250 ? "Normal" : "Slow"}
                              />
                              <MetricBlock
                                icon={Wifi}
                                label="Req/min"
                                value={service.requestsPerMin.toLocaleString()}
                              />
                              <MetricBlock
                                icon={AlertTriangle}
                                label="Error rate"
                                value={`${service.errorRate.toFixed(2)}%`}
                                tone={service.errorRate > 1 ? "warning" : "default"}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 xl:flex-col xl:shrink-0">
                          <Button variant="outline" size="sm">
                            <Terminal className="mr-2 h-4 w-4" />
                            Logs
                          </Button>
                          <Button variant="outline" size="sm">
                            <Play className="mr-2 h-4 w-4" />
                            Run check
                          </Button>
                          <Button variant="outline" size="sm">
                            <LineChart className="mr-2 h-4 w-4" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Incident log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  Incident Log
                </CardTitle>
                <CardDescription>Recent incidents across monitored services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {incidents.map((inc, idx) => (
                  <div key={inc.id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            inc.severity === "high"
                              ? "bg-destructive/10 text-destructive"
                              : inc.severity === "medium"
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{inc.title}</h4>
                            <Badge
                              variant="outline"
                              className={
                                inc.status === "resolved"
                                  ? "border-success/30 bg-success/10 text-success"
                                  : inc.status === "investigating"
                                    ? "border-warning/30 bg-warning/10 text-warning"
                                    : "border-primary/30 bg-primary/10 text-primary"
                              }
                            >
                              {inc.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{inc.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {inc.service} - {inc.startedAt} - Duration: {inc.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                    {idx < incidents.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Health Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Operational" value={stats.operational} tone="success" />
                <SummaryRow label="Degraded" value={stats.degraded} tone="warning" />
                <SummaryRow label="Down" value={stats.down} tone="destructive" />
                <Separator />
                <SummaryRow label="Avg uptime" value={`${stats.avgUptime.toFixed(2)}%`} />
                <SummaryRow label="Avg response" value={`${stats.avgResponse}ms`} />
                <SummaryRow label="Open incidents" value={incidents.filter((i) => i.status !== "resolved").length} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Preferences</CardTitle>
                <CardDescription>How admins get notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Degradation alerts</p>
                    <p className="text-xs text-muted-foreground">Notify on uptime drop</p>
                  </div>
                  <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Downtime alerts</p>
                    <p className="text-xs text-muted-foreground">Immediate page to on-call</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Weekly digest</p>
                    <p className="text-xs text-muted-foreground">Sunday at 09:00 UTC</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Scheduled Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {maintenance.map((m) => (
                  <div key={m.title} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.window}</p>
                    <p className="mt-1 text-xs text-warning">{m.impact}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run full health scan
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <ScrollText className="mr-2 h-4 w-4" />
                  Open incident tracker
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Export health report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: "primary" | "success" | "warning" | "destructive" | "chart-2"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    "chart-2": "bg-chart-2/10 text-chart-2",
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricBlock({
  icon: Icon,
  label,
  value,
  progress,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  progress?: number
  hint?: string
  tone?: "default" | "warning"
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <p className={`font-semibold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {progress !== undefined && <Progress value={progress} className="mt-1.5 h-1" />}
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: "success" | "warning" | "destructive"
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground"
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  )
}
