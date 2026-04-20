"use client"

import { useMemo } from "react"
import Link from "next/link"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  currentAdmin,
  mockStudents,
  mockSupervisors,
  mockSystemHealth,
  mockSystemStats,
  mockSupervisionRequests,
  mockProjects,
  mockMilestones,
} from "@/lib/mock-data"
import {
  Activity,
  Users,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Bell,
  TrendingUp,
  Settings,
  Database,
  Clock,
  UserPlus,
  FolderKanban,
  ShieldAlert,
  Sparkles,
  FileCheck2,
  Megaphone,
} from "lucide-react"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default function AdminDashboardPage() {
  const operationalServices = mockSystemHealth.filter((s) => s.status === "operational").length
  const degradedServices = mockSystemHealth.filter((s) => s.status === "degraded").length
  const downServices = mockSystemHealth.filter((s) => s.status === "down").length
  const averageUptime = useMemo(
    () =>
      mockSystemHealth.reduce((sum, s) => sum + s.uptime, 0) / mockSystemHealth.length,
    [],
  )

  const totalCapacity = mockSupervisors.reduce((sum, s) => sum + s.maxStudents, 0)
  const assignedStudents = mockSupervisors.reduce((sum, s) => sum + s.currentStudents, 0)
  const capacityUtilization = Math.round((assignedStudents / totalCapacity) * 100)
  const atCapacity = mockSupervisors.filter((s) => s.currentStudents >= s.maxStudents).length

  const unassignedStudents = mockStudents.filter((s) => !s.supervisorId).length

  const completionRate = Math.round(
    (mockMilestones.filter((m) => m.status === "completed").length / mockMilestones.length) * 100,
  )

  const healthStatus =
    downServices > 0 ? "critical" : degradedServices > 0 ? "attention" : "healthy"

  const alerts = [
    ...(degradedServices > 0
      ? [
          {
            level: "warning" as const,
            title: `${degradedServices} service${degradedServices > 1 ? "s" : ""} degraded`,
            description: "Notification service uptime dropped below 99%. Investigate promptly.",
            href: "/dashboard/admin/system-health",
            action: "Open system health",
          },
        ]
      : []),
    ...(atCapacity > 0
      ? [
          {
            level: "warning" as const,
            title: `${atCapacity} supervisor${atCapacity > 1 ? "s are" : " is"} at full capacity`,
            description: "New supervision requests may be delayed until slots free up.",
            href: "/dashboard/admin/supervisors",
            action: "Manage capacity",
          },
        ]
      : []),
    ...(unassignedStudents > 0
      ? [
          {
            level: "info" as const,
            title: `${unassignedStudents} student${unassignedStudents > 1 ? "s" : ""} without a supervisor`,
            description: "Review the matching queue to ensure timely allocation.",
            href: "/dashboard/admin/users",
            action: "Review users",
          },
        ]
      : []),
    ...(mockSystemStats.pendingRequests > 10
      ? [
          {
            level: "info" as const,
            title: `${mockSystemStats.pendingRequests} pending supervision requests`,
            description: "Requests are accumulating - consider opening a review cycle.",
            href: "/dashboard/admin/supervisors",
            action: "View requests",
          },
        ]
      : []),
  ]

  const recentActivity = [
    {
      icon: UserPlus,
      tone: "primary" as const,
      title: "New student registered",
      meta: "Emma Wilson joined the platform",
      time: "12 min ago",
    },
    {
      icon: FileCheck2,
      tone: "success" as const,
      title: "Supervision request accepted",
      meta: "Dr. Williams accepted John Smith's request",
      time: "47 min ago",
    },
    {
      icon: ShieldAlert,
      tone: "warning" as const,
      title: "Notification service degraded",
      meta: "Uptime dropped to 98.5% - auto-monitoring active",
      time: "2 hrs ago",
    },
    {
      icon: FolderKanban,
      tone: "chart-2" as const,
      title: "Milestone marked complete",
      meta: "Sarah Jones submitted Literature Review",
      time: "3 hrs ago",
    },
    {
      icon: Settings,
      tone: "primary" as const,
      title: "Capacity updated",
      meta: "Dr. Martinez max students increased to 6",
      time: "Yesterday",
    },
  ]

  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    "chart-2": "bg-chart-2/10 text-chart-2",
    destructive: "bg-destructive/10 text-destructive",
  }

  return (
    <DashboardShell user={currentAdmin} role="admin" title="Admin Dashboard">
      <div className="space-y-6">
        {/* Hero */}
        <Card className="overflow-hidden border-primary/20">
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary/30">
                  <AvatarImage src={currentAdmin.avatarUrl || "/placeholder.svg"} alt={currentAdmin.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(currentAdmin.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold md:text-3xl">Welcome back, {currentAdmin.name.split(" ")[0]}</h1>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Super Admin
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground md:text-base">
                    Full platform oversight across {mockStudents.length + mockSupervisors.length + 1} users,{" "}
                    {mockProjects.length} active projects, and {mockSystemHealth.length} monitored services.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Signed in {new Date().toLocaleDateString("en-GB", { dateStyle: "medium" })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {currentAdmin.permissions.length} permission groups
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity
                        className={`h-3.5 w-3.5 ${
                          healthStatus === "healthy"
                            ? "text-success"
                            : healthStatus === "attention"
                              ? "text-warning"
                              : "text-destructive"
                        }`}
                      />
                      Platform {healthStatus === "healthy" ? "operating normally" : healthStatus === "attention" ? "needs attention" : "has critical issues"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard/admin/system-health">
                    <Activity className="mr-2 h-4 w-4" />
                    System Health
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/dashboard/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Platform Settings
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            icon={Users}
            label="Total Users"
            value={mockStudents.length + mockSupervisors.length + 1}
            hint={`${unassignedStudents} unassigned`}
            tone="primary"
          />
          <StatCard
            icon={GraduationCap}
            label="Students"
            value={mockSystemStats.totalStudents}
            hint={`${mockStudents.length} demo accounts`}
            tone="chart-2"
          />
          <StatCard
            icon={Briefcase}
            label="Supervisors"
            value={mockSystemStats.totalSupervisors}
            hint={`${mockSupervisors.length} active`}
            tone="success"
          />
          <StatCard
            icon={FolderKanban}
            label="Active Projects"
            value={mockSystemStats.activeProjects}
            hint={`${mockSystemStats.completedProjects} completed`}
            tone="primary"
          />
          <StatCard
            icon={Bell}
            label="Pending Requests"
            value={mockSystemStats.pendingRequests}
            hint="Awaiting review"
            tone="warning"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg. Match Score"
            value={`${mockSystemStats.averageMatchScore}%`}
            hint="AI matching quality"
            tone="success"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 xl:col-span-2">
            {/* System Health */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">System Health Overview</CardTitle>
                  <CardDescription>
                    Live status across {mockSystemHealth.length} core services - avg uptime {averageUptime.toFixed(2)}%
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/admin/system-health">
                    View all
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockSystemHealth.map((service) => (
                  <div key={service.service} className="rounded-xl border p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            service.status === "operational"
                              ? "bg-success/10 text-success"
                              : service.status === "degraded"
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {service.service.toLowerCase().includes("database") ? (
                            <Database className="h-4 w-4" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{service.service}</p>
                          <p className="text-xs text-muted-foreground">
                            Last check {new Date(service.lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          service.status === "operational"
                            ? "border-success/30 bg-success/10 text-success"
                            : service.status === "degraded"
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                      >
                        {service.status === "operational" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {service.status === "degraded" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {service.status === "down" && <ShieldAlert className="mr-1 h-3 w-3" />}
                        {service.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={service.uptime} className="h-1.5" />
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {service.uptime}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Platform metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Platform Metrics</CardTitle>
                <CardDescription>Key indicators of health, load, and engagement</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <MetricTile
                  label="Supervision capacity"
                  value={`${assignedStudents}/${totalCapacity}`}
                  sub={`${capacityUtilization}% utilized`}
                  progress={capacityUtilization}
                  tone={capacityUtilization >= 90 ? "warning" : "primary"}
                />
                <MetricTile
                  label="Milestone completion"
                  value={`${completionRate}%`}
                  sub={`${mockMilestones.filter((m) => m.status === "completed").length} of ${mockMilestones.length} milestones done`}
                  progress={completionRate}
                  tone="success"
                />
                <MetricTile
                  label="System uptime"
                  value={`${averageUptime.toFixed(2)}%`}
                  sub={`${operationalServices} operational / ${degradedServices} degraded`}
                  progress={averageUptime}
                  tone={averageUptime >= 99.5 ? "success" : "warning"}
                />
                <MetricTile
                  label="Match quality"
                  value={`${mockSystemStats.averageMatchScore}%`}
                  sub="AI matching engine confidence"
                  progress={mockSystemStats.averageMatchScore}
                  tone="chart-2"
                />
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">Recent Platform Activity</CardTitle>
                  <CardDescription>Latest user, project, and system events</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  View audit log
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {recentActivity.map((event, idx) => {
                    const Icon = event.icon
                    return (
                      <div key={idx}>
                        <div className="flex items-start gap-3 py-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneMap[event.tone]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.meta}</p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{event.time}</span>
                        </div>
                        {idx < recentActivity.length - 1 && <Separator />}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Alerts */}
            {alerts.length > 0 && (
              <Card className="border-warning/30 bg-warning/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Needs Your Attention
                  </CardTitle>
                  <CardDescription>{alerts.length} active alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className="rounded-xl border bg-background p-3">
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            alert.level === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                          }`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-semibold">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">{alert.description}</p>
                          <Button asChild size="sm" variant="ghost" className="-ml-2 h-7 text-xs">
                            <Link href={alert.href}>
                              {alert.action}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Admin permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Your Permissions</CardTitle>
                <CardDescription>Granted privilege groups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentAdmin.permissions.map((perm) => (
                  <div key={perm} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium capitalize">{perm.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                      Active
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
                <CardDescription>Common admin workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <Link href="/dashboard/admin/users">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite new user
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <Link href="/dashboard/admin/supervisors">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Adjust supervisor capacity
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <Link href="/dashboard/admin/data-management">
                    <Database className="mr-2 h-4 w-4" />
                    Export platform data
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Broadcast announcement
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Re-run AI matching
                </Button>
              </CardContent>
            </Card>

            {/* Security checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Security Posture</CardTitle>
                <CardDescription>Platform safeguards status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Role-based access control", active: true },
                  { label: "Two-factor on admin accounts", active: true },
                  { label: "Audit logging enabled", active: true },
                  { label: "Automated backups", active: true },
                  { label: "Session timeout policy", active: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                ))}
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
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint: string
  tone: "primary" | "success" | "warning" | "chart-2" | "destructive"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    "chart-2": "bg-chart-2/10 text-chart-2",
    destructive: "bg-destructive/10 text-destructive",
  }
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricTile({
  label,
  value,
  sub,
  progress,
  tone,
}: {
  label: string
  value: string
  sub: string
  progress: number
  tone: "primary" | "success" | "warning" | "chart-2"
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <Progress value={progress} className="mt-3 h-1.5" />
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
