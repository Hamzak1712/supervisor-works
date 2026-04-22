"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import type { User } from "@/types"
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
} from "lucide-react"

type ServiceStatus = "operational" | "degraded" | "down"

type SystemHealthPayload = {
  generatedAt: string
  services: Array<{
    serviceKey: "db" | "api" | "ai" | "email" | "storage"
    serviceName: string
    status: ServiceStatus
    responseMs: number
    requestPerMin: number | null
    errorRatePercent: number | null
    queueDepth: number | null
    details?: string
  }>
  resources: {
    cpuPercent: number
    memoryPercent: number
    storagePercent: number | null
    dbConnections: number | null
  }
  statusCounts: {
    operational: number
    degraded: number
    down: number
  }
  config: {
    errorRateSpikeThreshold: number
    queueDepthWarning: number
    queueDepthCritical: number
    maintenanceBannerLeadMin: number
  }
  signal: {
    apiRequestsLast5m: number
    api5xxLast5m: number
    aiQueueDepth: number
    emailQueueDepth: number
  }
  alerts: {
    errorSpike: boolean
    queueSpike: boolean
    errorRatePercent: number
    queueDepth: number
  }
  incidents: Array<{
    id: string
    serviceKey: string
    title: string
    severity: string
    status: string
    ownerEmail: string | null
    description: string | null
    resolutionNotes: string | null
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    createdByEmail: string | null
  }>
  maintenanceWindows: Array<{
    id: string
    title: string
    message: string
    impact: string | null
    startsAt: string
    endsAt: string
    createdAt: string
    createdByEmail: string | null
    activeNow: boolean
    startsSoon: boolean
  }>
  trends: Record<
    string,
    {
      h24: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
      d7: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
      d30: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
    }
  >
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function toneClass(status: ServiceStatus) {
  if (status === "operational") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  if (status === "degraded") return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  return "border-red-500/30 bg-red-500/10 text-red-700"
}

function serviceIcon(serviceKey: string): ComponentType<{ className?: string }> {
  if (serviceKey === "db") return Database
  if (serviceKey === "storage") return HardDrive
  if (serviceKey === "api") return Wifi
  if (serviceKey === "ai") return Cpu
  return Bell
}

export default function AdminSystemHealthPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [payload, setPayload] = useState<SystemHealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [trendRange, setTrendRange] = useState<"24h" | "7d" | "30d">("24h")
  const [trendServiceKey, setTrendServiceKey] = useState("db")

  const [incidentServiceKey, setIncidentServiceKey] = useState("api")
  const [incidentTitle, setIncidentTitle] = useState("")
  const [incidentSeverity, setIncidentSeverity] = useState("medium")
  const [incidentOwnerEmail, setIncidentOwnerEmail] = useState("")
  const [incidentDescription, setIncidentDescription] = useState("")

  const [maintenanceTitle, setMaintenanceTitle] = useState("")
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [maintenanceImpact, setMaintenanceImpact] = useState("")
  const [maintenanceStartsAt, setMaintenanceStartsAt] = useState("")
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState("")

  const [thresholdErrorRate, setThresholdErrorRate] = useState("5")
  const [thresholdQueueWarn, setThresholdQueueWarn] = useState("25")
  const [thresholdQueueCritical, setThresholdQueueCritical] = useState("60")
  const [thresholdMaintenanceLead, setThresholdMaintenanceLead] = useState("120")

  const [signalApiRequests, setSignalApiRequests] = useState("1")
  const [signalApi5xx, setSignalApi5xx] = useState("0")
  const [signalAiQueue, setSignalAiQueue] = useState("0")
  const [signalEmailQueue, setSignalEmailQueue] = useState("0")

  function authHeaders() {
    const token = localStorage.getItem("token")
    return { Authorization: `Bearer ${token}` }
  }

  function hydrate(data: SystemHealthPayload) {
    setPayload(data)
    setThresholdErrorRate(String(data.config.errorRateSpikeThreshold))
    setThresholdQueueWarn(String(data.config.queueDepthWarning))
    setThresholdQueueCritical(String(data.config.queueDepthCritical))
    setThresholdMaintenanceLead(String(data.config.maintenanceBannerLeadMin))
    setSignalApiRequests(String(data.signal.apiRequestsLast5m))
    setSignalApi5xx(String(data.signal.api5xxLast5m))
    setSignalAiQueue(String(data.signal.aiQueueDepth))
    setSignalEmailQueue(String(data.signal.emailQueueDepth))

    if (!data.services.some((service) => service.serviceKey === trendServiceKey)) {
      setTrendServiceKey(data.services[0]?.serviceKey || "db")
    }
    if (!incidentServiceKey && data.services[0]) {
      setIncidentServiceKey(data.services[0].serviceKey)
    }
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, healthRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/system-health", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const healthData = (await healthRes.json()) as SystemHealthPayload | { error?: string }

      if (!healthRes.ok || !("services" in healthData)) {
        throw new Error((healthData as { error?: string })?.error || "Failed to load system health")
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

      hydrate(healthData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load system health.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(body: Record<string, unknown>, successNotice: string) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/system-health", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as SystemHealthPayload | { error?: string }
      if (!res.ok || !("services" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)
      setNotice(successNotice)
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
    }, 15000)
    return () => window.clearInterval(intervalId)
  }, [])

  const trendPoints = useMemo(() => {
    if (!payload) return []
    const trendSet = payload.trends?.[trendServiceKey]
    if (!trendSet) return []
    if (trendRange === "24h") return trendSet.h24
    if (trendRange === "7d") return trendSet.d7
    return trendSet.d30
  }, [payload, trendRange, trendServiceKey])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="System Health">
        <div className="p-6">Loading system health...</div>
      </DashboardShell>
    )
  }

  const overallStatus =
    payload.statusCounts.down > 0
      ? "critical"
      : payload.statusCounts.degraded > 0
        ? "degraded"
        : "healthy"

  return (
    <DashboardShell user={shellUser} role="admin" title="System Health">
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

        <Card
          className={
            overallStatus === "critical"
              ? "border-red-500/30"
              : overallStatus === "degraded"
                ? "border-amber-500/30"
                : "border-emerald-500/30"
          }
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Overall status</p>
              <p className="text-xl font-semibold capitalize">{overallStatus}</p>
              <p className="text-xs text-muted-foreground">
                Last scan: {new Date(payload.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fetchData()} disabled={busy}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={() => runAction({ action: "run_health_scan" }, "Health scan completed.")}
                disabled={busy}
              >
                <Activity className="mr-2 h-4 w-4" />
                Run full scan
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CheckCircle2} label="Operational" value={String(payload.statusCounts.operational)} />
          <MetricCard icon={AlertTriangle} label="Degraded" value={String(payload.statusCounts.degraded)} />
          <MetricCard icon={XCircle} label="Down" value={String(payload.statusCounts.down)} />
          <MetricCard icon={Server} label="Services" value={String(payload.services.length)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Live Service Status Grid</CardTitle>
            <CardDescription>
              Database, API, AI microservice, email gateway, and file storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {payload.services.map((service) => {
              const Icon = serviceIcon(service.serviceKey)
              return (
                <div key={service.serviceKey} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <Badge className={toneClass(service.status)}>{service.status}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{service.serviceName}</p>
                  <p className="text-xs text-muted-foreground">{service.responseMs}ms response</p>
                  <p className="text-xs text-muted-foreground">
                    RPM: {service.requestPerMin ?? 0}
                  </p>
                  {service.errorRatePercent !== null && (
                    <p className="text-xs text-muted-foreground">
                      Error: {service.errorRatePercent.toFixed(2)}%
                    </p>
                  )}
                  {service.queueDepth !== null && (
                    <p className="text-xs text-muted-foreground">Queue: {service.queueDepth}</p>
                  )}
                  {service.details && (
                    <p className="mt-1 text-xs text-muted-foreground">{service.details}</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Resource Gauges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <GaugeRow icon={Cpu} label="CPU" value={payload.resources.cpuPercent} />
              <GaugeRow icon={Server} label="Memory" value={payload.resources.memoryPercent} />
              <GaugeRow
                icon={HardDrive}
                label="Storage"
                value={payload.resources.storagePercent ?? 0}
              />
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground">DB connections</p>
                <p className="text-xl font-semibold">{payload.resources.dbConnections ?? "n/a"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Uptime & Response Trends</CardTitle>
              <CardDescription>24h / 7d / 30d trend points per service.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select value={trendServiceKey} onValueChange={setTrendServiceKey}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.services.map((service) => (
                        <SelectItem key={service.serviceKey} value={service.serviceKey}>
                          {service.serviceName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Range</Label>
                  <Select
                    value={trendRange}
                    onValueChange={(value: "24h" | "7d" | "30d") => setTrendRange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24h</SelectItem>
                      <SelectItem value="7d">7d</SelectItem>
                      <SelectItem value="30d">30d</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                {trendPoints.slice(-12).map((point) => (
                  <div key={point.timestamp} className="rounded-md border p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>{new Date(point.timestamp).toLocaleString()}</span>
                      <span>{point.avgResponseMs}ms</span>
                    </div>
                    <Progress value={point.uptimePercent} className="mt-2 h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uptime {point.uptimePercent.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Error-Rate Monitor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Current 5xx rate:{" "}
                <span className={payload.alerts.errorSpike ? "text-red-600 font-semibold" : "font-semibold"}>
                  {payload.alerts.errorRatePercent.toFixed(2)}%
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Requests last 5m: {payload.signal.apiRequestsLast5m} • 5xx: {payload.signal.api5xxLast5m}
              </p>
              <div className="space-y-2">
                <Label>Spike threshold %</Label>
                <Input
                  value={thresholdErrorRate}
                  onChange={(e) => setThresholdErrorRate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Depth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                AI queue depth:{" "}
                <span className={payload.alerts.queueSpike ? "text-amber-700 font-semibold" : "font-semibold"}>
                  {payload.signal.aiQueueDepth}
                </span>
              </p>
              <div className="space-y-2">
                <Label>Queue warning threshold</Label>
                <Input
                  value={thresholdQueueWarn}
                  onChange={(e) => setThresholdQueueWarn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Queue critical threshold</Label>
                <Input
                  value={thresholdQueueCritical}
                  onChange={(e) => setThresholdQueueCritical(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signal Input</CardTitle>
              <CardDescription>Update runtime counters used for spike/congestion alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={signalApiRequests}
                onChange={(e) => setSignalApiRequests(e.target.value)}
                placeholder="API requests last 5m"
              />
              <Input
                value={signalApi5xx}
                onChange={(e) => setSignalApi5xx(e.target.value)}
                placeholder="API 5xx last 5m"
              />
              <Input
                value={signalAiQueue}
                onChange={(e) => setSignalAiQueue(e.target.value)}
                placeholder="AI queue depth"
              />
              <Input
                value={signalEmailQueue}
                onChange={(e) => setSignalEmailQueue(e.target.value)}
                placeholder="Email queue depth"
              />
              <Button
                onClick={() =>
                  runAction(
                    {
                      action: "update_signal",
                      apiRequestsLast5m: Number(signalApiRequests),
                      api5xxLast5m: Number(signalApi5xx),
                      aiQueueDepth: Number(signalAiQueue),
                      emailQueueDepth: Number(signalEmailQueue),
                    },
                    "Runtime signals updated."
                  )
                }
                disabled={busy}
              >
                Update Signals
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Threshold Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Error spike threshold</Label>
              <Input value={thresholdErrorRate} onChange={(e) => setThresholdErrorRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Queue warning</Label>
              <Input value={thresholdQueueWarn} onChange={(e) => setThresholdQueueWarn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Queue critical</Label>
              <Input value={thresholdQueueCritical} onChange={(e) => setThresholdQueueCritical(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Maintenance banner lead (min)</Label>
              <Input
                value={thresholdMaintenanceLead}
                onChange={(e) => setThresholdMaintenanceLead(e.target.value)}
              />
            </div>
            <div className="md:col-span-4">
              <Button
                onClick={() =>
                  runAction(
                    {
                      action: "update_config",
                      errorRateSpikeThreshold: Number(thresholdErrorRate),
                      queueDepthWarning: Number(thresholdQueueWarn),
                      queueDepthCritical: Number(thresholdQueueCritical),
                      maintenanceBannerLeadMin: Number(thresholdMaintenanceLead),
                    },
                    "Threshold configuration saved."
                  )
                }
                disabled={busy}
              >
                Save Config
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Incident Log</CardTitle>
              <CardDescription>Create and track incidents by severity and owner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select value={incidentServiceKey} onValueChange={setIncidentServiceKey}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.services.map((service) => (
                        <SelectItem key={service.serviceKey} value={service.serviceKey}>
                          {service.serviceName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">low</SelectItem>
                      <SelectItem value="medium">medium</SelectItem>
                      <SelectItem value="high">high</SelectItem>
                      <SelectItem value="critical">critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} placeholder="Incident title" />
              <Input
                value={incidentOwnerEmail}
                onChange={(e) => setIncidentOwnerEmail(e.target.value)}
                placeholder="Owner email (optional)"
              />
              <Textarea
                rows={3}
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Incident description"
              />
              <Button
                onClick={() =>
                  runAction(
                    {
                      action: "create_incident",
                      serviceKey: incidentServiceKey,
                      title: incidentTitle,
                      severity: incidentSeverity,
                      ownerEmail: incidentOwnerEmail,
                      description: incidentDescription,
                    },
                    "Incident created."
                  )
                }
                disabled={busy || !incidentTitle.trim()}
              >
                Create incident
              </Button>
              <div className="space-y-2">
                {payload.incidents.map((incident) => (
                  <div key={incident.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{incident.title}</p>
                      <Badge variant="outline">
                        {incident.severity} • {incident.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {incident.serviceKey} • Owner {incident.ownerEmail || "unassigned"} •{" "}
                      {new Date(incident.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || incident.status === "resolved"}
                        onClick={() =>
                          runAction(
                            {
                              action: "update_incident",
                              incidentId: incident.id,
                              status: "resolved",
                            },
                            "Incident marked resolved."
                          )
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Maintenance Windows</CardTitle>
              <CardDescription>
                Published windows auto-appear as banner announcements near start time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={maintenanceTitle}
                onChange={(e) => setMaintenanceTitle(e.target.value)}
                placeholder="Maintenance title"
              />
              <Textarea
                rows={2}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Maintenance message"
              />
              <Input
                value={maintenanceImpact}
                onChange={(e) => setMaintenanceImpact(e.target.value)}
                placeholder="Impact (optional)"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Input type="datetime-local" value={maintenanceStartsAt} onChange={(e) => setMaintenanceStartsAt(e.target.value)} />
                <Input type="datetime-local" value={maintenanceEndsAt} onChange={(e) => setMaintenanceEndsAt(e.target.value)} />
              </div>
              <Button
                onClick={() =>
                  runAction(
                    {
                      action: "create_maintenance_window",
                      title: maintenanceTitle,
                      message: maintenanceMessage,
                      impact: maintenanceImpact,
                      startsAt: maintenanceStartsAt,
                      endsAt: maintenanceEndsAt,
                    },
                    "Maintenance window created."
                  )
                }
                disabled={
                  busy ||
                  !maintenanceTitle.trim() ||
                  !maintenanceMessage.trim() ||
                  !maintenanceStartsAt ||
                  !maintenanceEndsAt
                }
              >
                Add window
              </Button>
              <div className="space-y-2">
                {payload.maintenanceWindows.map((windowItem) => (
                  <div key={windowItem.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{windowItem.title}</p>
                      {windowItem.activeNow ? (
                        <Badge className="border-red-500/30 bg-red-500/10 text-red-600">active</Badge>
                      ) : windowItem.startsSoon ? (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-700">starts soon</Badge>
                      ) : (
                        <Badge variant="outline">scheduled</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(windowItem.startsAt).toLocaleString()} -{" "}
                      {new Date(windowItem.endsAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{windowItem.message}</p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            {
                              action: "delete_maintenance_window",
                              windowId: windowItem.id,
                            },
                            "Maintenance window deleted."
                          )
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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

function GaugeRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} className="mt-2 h-2" />
    </div>
  )
}
