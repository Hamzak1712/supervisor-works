"use client"

import { useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { currentAdmin, mockSupervisors } from "@/lib/mock-data"
import type { SupervisorProfile } from "@/types"
import {
  Briefcase,
  Users,
  Search,
  GraduationCap,
  FolderOpen,
  CheckCircle2,
  Filter,
  UserPlus,
  Download,
  MoreHorizontal,
  AlertTriangle,
  Plus,
  Minus,
  Save,
  X,
  Mail,
  Ban,
  Pencil,
  TrendingUp,
  Building2,
} from "lucide-react"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface SupervisorRow extends SupervisorProfile {
  status: "active" | "suspended"
  acceptingStudents: boolean
}

export default function AdminSupervisorsPage() {
  const initial: SupervisorRow[] = useMemo(
    () =>
      mockSupervisors.map((s) => ({
        ...s,
        status: "active",
        acceptingStudents: s.currentStudents < s.maxStudents,
      })),
    [],
  )

  const [supervisors, setSupervisors] = useState<SupervisorRow[]>(initial)
  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [capacityFilter, setCapacityFilter] = useState("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<number>(0)

  const departments = useMemo(() => Array.from(new Set(supervisors.map((s) => s.department))), [supervisors])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return supervisors.filter((s) => {
      if (departmentFilter !== "all" && s.department !== departmentFilter) return false
      if (capacityFilter === "available" && s.currentStudents >= s.maxStudents) return false
      if (capacityFilter === "full" && s.currentStudents < s.maxStudents) return false
      if (capacityFilter === "low" && s.currentStudents / s.maxStudents > 0.5) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.expertise.some((e) => e.toLowerCase().includes(q)) ||
        s.researchAreas.some((r) => r.toLowerCase().includes(q))
      )
    })
  }, [supervisors, search, departmentFilter, capacityFilter])

  const totals = useMemo(() => {
    const totalCapacity = supervisors.reduce((sum, s) => sum + s.maxStudents, 0)
    const totalAssigned = supervisors.reduce((sum, s) => sum + s.currentStudents, 0)
    return {
      total: supervisors.length,
      assigned: totalAssigned,
      capacity: totalCapacity,
      remaining: totalCapacity - totalAssigned,
      utilization: Math.round((totalAssigned / totalCapacity) * 100),
      atCapacity: supervisors.filter((s) => s.currentStudents >= s.maxStudents).length,
      notAccepting: supervisors.filter((s) => !s.acceptingStudents).length,
    }
  }, [supervisors])

  function startEdit(sup: SupervisorRow) {
    setEditingId(sup.id)
    setEditDraft(sup.maxStudents)
  }

  function saveEdit(id: string) {
    setSupervisors((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              maxStudents: Math.max(s.currentStudents, editDraft),
              acceptingStudents: s.currentStudents < Math.max(s.currentStudents, editDraft),
            }
          : s,
      ),
    )
    setEditingId(null)
  }

  function adjustCapacity(id: string, delta: number) {
    setSupervisors((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              maxStudents: Math.max(s.currentStudents, s.maxStudents + delta),
            }
          : s,
      ),
    )
  }

  function toggleAccepting(id: string) {
    setSupervisors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, acceptingStudents: !s.acceptingStudents } : s)),
    )
  }

  function suspend(id: string) {
    setSupervisors((prev) => prev.map((s) => (s.id === id ? { ...s, status: "suspended" } : s)))
  }

  const topLoad = [...supervisors]
    .sort((a, b) => b.currentStudents / b.maxStudents - a.currentStudents / a.maxStudents)
    .slice(0, 3)

  return (
    <DashboardShell user={currentAdmin} role="admin" title="Supervisors">
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Supervisor Management</h2>
            <p className="text-sm text-muted-foreground">
              Adjust capacity, expertise, and availability across all supervisors
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add supervisor
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Briefcase}
            label="Total Supervisors"
            value={totals.total}
            hint={`${totals.notAccepting} not accepting`}
            tone="primary"
          />
          <StatCard
            icon={Users}
            label="Assigned Students"
            value={totals.assigned}
            hint={`${totals.utilization}% utilization`}
            tone="chart-2"
          />
          <StatCard
            icon={CheckCircle2}
            label="Total Capacity"
            value={totals.capacity}
            hint={`${totals.remaining} slots available`}
            tone="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="At Capacity"
            value={totals.atCapacity}
            hint={totals.atCapacity > 0 ? "Need attention" : "All have headroom"}
            tone={totals.atCapacity > 0 ? "warning" : "success"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="space-y-6 xl:col-span-3">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, department, or expertise..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="w-[200px]">
                        <Building2 className="mr-2 h-3.5 w-3.5" />
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                      <SelectTrigger className="w-[180px]">
                        <Filter className="mr-2 h-3.5 w-3.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All capacity</SelectItem>
                        <SelectItem value="available">Has availability</SelectItem>
                        <SelectItem value="low">Low load (&lt;50%)</SelectItem>
                        <SelectItem value="full">At capacity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* List */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Supervisor Roster</CardTitle>
                <CardDescription>
                  Showing {filtered.length} of {totals.total} supervisors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                    <Briefcase className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No supervisors match your filters</p>
                  </div>
                ) : (
                  filtered.map((sup) => {
                    const utilization = Math.round((sup.currentStudents / sup.maxStudents) * 100)
                    const isEditing = editingId === sup.id
                    return (
                      <div key={sup.id} className="rounded-xl border p-5 transition hover:bg-muted/20">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1 space-y-4">
                            {/* Header */}
                            <div className="flex items-start gap-3">
                              <Avatar className="h-12 w-12 shrink-0">
                                <AvatarImage src={sup.avatarUrl || "/placeholder.svg"} alt={sup.name} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {getInitials(sup.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold">{sup.name}</h3>
                                  <Badge
                                    variant="outline"
                                    className={
                                      sup.status === "active"
                                        ? "border-success/30 bg-success/10 text-success"
                                        : "border-destructive/30 bg-destructive/10 text-destructive"
                                    }
                                  >
                                    {sup.status}
                                  </Badge>
                                  {!sup.acceptingStudents && (
                                    <Badge
                                      variant="outline"
                                      className="border-warning/30 bg-warning/10 text-warning"
                                    >
                                      Not accepting
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{sup.email}</p>
                                <p className="text-xs text-muted-foreground">{sup.department}</p>
                              </div>
                            </div>

                            {/* Capacity */}
                            <div className="rounded-xl border bg-muted/20 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium">Supervision capacity</span>
                                </div>
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {sup.currentStudents} assigned -
                                    </span>
                                    <Input
                                      type="number"
                                      min={sup.currentStudents}
                                      max={20}
                                      value={editDraft}
                                      onChange={(e) => setEditDraft(Number(e.target.value))}
                                      className="h-7 w-16"
                                    />
                                    <Button size="sm" className="h-7" onClick={() => saveEdit(sup.id)}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7"
                                      onClick={() => setEditingId(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 w-7 p-0 bg-transparent"
                                      onClick={() => adjustCapacity(sup.id, -1)}
                                      disabled={sup.maxStudents <= sup.currentStudents}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="min-w-[70px] text-center text-sm font-semibold tabular-nums">
                                      {sup.currentStudents} / {sup.maxStudents}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 w-7 p-0 bg-transparent"
                                      onClick={() => adjustCapacity(sup.id, 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7"
                                      onClick={() => startEdit(sup)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <Progress
                                value={utilization}
                                className={`h-2 ${
                                  utilization >= 90
                                    ? "[&>div]:bg-warning"
                                    : utilization >= 100
                                      ? "[&>div]:bg-destructive"
                                      : ""
                                }`}
                              />
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {utilization}% utilized - {sup.maxStudents - sup.currentStudents} slot
                                {sup.maxStudents - sup.currentStudents !== 1 ? "s" : ""} available
                              </p>
                            </div>

                            {/* Expertise */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Expertise</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sup.expertise.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="border-primary/20 bg-primary/5 text-primary"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* Research */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Research areas</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sup.researchAreas.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="font-normal">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            {/* Past projects */}
                            <div className="rounded-xl border bg-background p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                  Past projects ({sup.pastProjects.length})
                                </p>
                              </div>
                              <div className="space-y-1">
                                {sup.pastProjects.slice(0, 2).map((p) => (
                                  <div key={p} className="truncate text-xs text-muted-foreground">
                                    - {p}
                                  </div>
                                ))}
                                {sup.pastProjects.length > 2 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{sup.pastProjects.length - 2} more
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 xl:flex-col xl:shrink-0">
                            <Button variant="outline" size="sm" className="flex-1 xl:flex-none bg-transparent">
                              <GraduationCap className="mr-2 h-4 w-4" />
                              View profile
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAccepting(sup.id)}
                              className="flex-1 bg-transparent xl:flex-none"
                            >
                              {sup.acceptingStudents ? "Pause intake" : "Resume intake"}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Email supervisor
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Manage expertise
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Users className="mr-2 h-4 w-4" />
                                  Reassign students
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => suspend(sup.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Disable account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Capacity Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Platform utilization</span>
                    <span className="text-2xl font-bold tabular-nums">{totals.utilization}%</span>
                  </div>
                  <Progress value={totals.utilization} className="h-2" />
                </div>
                <Separator />
                <SummaryRow label="Total supervisors" value={totals.total} />
                <SummaryRow label="Assigned students" value={totals.assigned} />
                <SummaryRow label="Capacity remaining" value={totals.remaining} tone="success" />
                <SummaryRow
                  label="At capacity"
                  value={totals.atCapacity}
                  tone={totals.atCapacity > 0 ? "warning" : undefined}
                />
                <SummaryRow
                  label="Not accepting"
                  value={totals.notAccepting}
                  tone={totals.notAccepting > 0 ? "warning" : undefined}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Highest Load
                </CardTitle>
                <CardDescription>Supervisors nearing their limit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topLoad.map((s) => {
                  const pct = Math.round((s.currentStudents / s.maxStudents) * 100)
                  return (
                    <div key={s.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.currentStudents}/{s.maxStudents}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-1.5 ${pct >= 90 ? "[&>div]:bg-warning" : ""}`}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Mail className="mr-2 h-4 w-4" />
                  Email all supervisors
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Review capacity limits
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Export supervisor data
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin Guidance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Max capacity cannot drop below the number of currently assigned students. Reassign first if you
                  need to reduce further.
                </p>
                <p>
                  Pausing intake keeps existing students supervised but prevents new requests from being matched to
                  this supervisor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Label import guard */}
        <span className="hidden">
          <Label>hidden</Label>
        </span>
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
  value: number
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
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  )
}
