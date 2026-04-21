"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { User } from "@/types"
import {
  Briefcase,
  Users,
  Search,
  Save,
  PauseCircle,
  PlayCircle,
  ArrowRightLeft,
  ArrowRight,
  Bell,
  Clock3,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"

type SupervisorRow = {
  userId: string
  email: string
  status: "ACTIVE" | "SUSPENDED" | "PENDING"
  fullName: string
  expertise: string[]
  maxCapacity: number
  currentStudents: number
  remainingSlots: number
  acceptingStudents: boolean
  pendingRequests: number
  avgResponseDays: number | null
  responseTimeFlag: boolean
}

type PendingApplication = {
  userId: string
  email: string
  fullName: string
  createdAt: string
}

type StudentOption = {
  userId: string
  email: string
  fullName: string
  supervisorId: string | null
}

type ApiResponse = {
  supervisors: SupervisorRow[]
  pendingApplications: PendingApplication[]
  students: StudentOption[]
  summary: {
    totalSupervisors: number
    acceptingSupervisors: number
    pausedIntake: number
    flaggedResponseTime: number
    totalCapacity: number
    totalAssigned: number
  }
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

export default function AdminSupervisorsPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [pendingApplications, setPendingApplications] = useState<PendingApplication[]>([])
  const [summary, setSummary] = useState<ApiResponse["summary"]>({
    totalSupervisors: 0,
    acceptingSupervisors: 0,
    pausedIntake: 0,
    flaggedResponseTime: 0,
    totalCapacity: 0,
    totalAssigned: 0,
  })

  const [search, setSearch] = useState("")
  const [intakeFilter, setIntakeFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [busy, setBusy] = useState(false)

  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, string>>({})

  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [targetSupervisorId, setTargetSupervisorId] = useState("")
  const [fromSupervisorId, setFromSupervisorId] = useState("")
  const [toSupervisorId, setToSupervisorId] = useState("")

  const authHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  function hydrate(data: ApiResponse) {
    setSupervisors(data.supervisors || [])
    setStudents(data.students || [])
    setPendingApplications(data.pendingApplications || [])
    setSummary(data.summary)
    setCapacityDrafts((prev) => {
      const next: Record<string, string> = { ...prev }
      data.supervisors.forEach((sup) => {
        if (!next[sup.userId]) {
          next[sup.userId] = String(sup.maxCapacity)
        }
      })
      return next
    })
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, supervisorsRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/supervisors", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const supervisorsData = (await supervisorsRes.json()) as ApiResponse | { error?: string }

      if (!supervisorsRes.ok || !("supervisors" in supervisorsData)) {
        throw new Error((supervisorsData as { error?: string })?.error || "Failed to load supervisors")
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

      hydrate(supervisorsData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load supervisors.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(payload: Record<string, unknown>, successMessage: string) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/supervisors", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as ApiResponse | { error?: string }

      if (!res.ok || !("supervisors" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)
      setActionNotice(successMessage)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Action failed")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchData(true)

    const intervalId = window.setInterval(() => {
      void fetchData()
    }, 7000)

    return () => window.clearInterval(intervalId)
  }, [])

  const filteredSupervisors = useMemo(() => {
    const q = search.trim().toLowerCase()

    return supervisors.filter((sup) => {
      if (intakeFilter === "accepting" && !sup.acceptingStudents) return false
      if (intakeFilter === "paused" && sup.acceptingStudents) return false
      if (intakeFilter === "slow" && !sup.responseTimeFlag) return false
      if (!q) return true

      return (
        sup.fullName.toLowerCase().includes(q) ||
        sup.email.toLowerCase().includes(q) ||
        sup.expertise.some((item) => item.toLowerCase().includes(q))
      )
    })
  }, [supervisors, search, intakeFilter])

  const activeSupervisors = supervisors.filter((s) => s.status === "ACTIVE")

  const assignableStudents = students.filter(
    (student) => !targetSupervisorId || student.supervisorId !== targetSupervisorId
  )

  function pct(current: number, max: number) {
    const safeMax = max > 0 ? max : 1
    return Math.round((current / safeMax) * 100)
  }

  if (loading) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Supervisor Management">
        <div className="p-6">Loading supervisor management...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Supervisor Management">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        {actionNotice && (
          <Card className="border-emerald-500/30">
            <CardContent className="p-4 text-sm text-emerald-600">{actionNotice}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={Briefcase} label="Supervisors" value={summary.totalSupervisors} />
          <StatCard icon={Users} label="Assigned" value={summary.totalAssigned} />
          <StatCard icon={ShieldCheck} label="Capacity" value={summary.totalCapacity} />
          <StatCard icon={PlayCircle} label="Accepting" value={summary.acceptingSupervisors} />
          <StatCard icon={PauseCircle} label="Intake Paused" value={summary.pausedIntake} />
          <StatCard icon={Clock3} label=">7d Response" value={summary.flaggedResponseTime} />
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="space-y-6 xl:col-span-3">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search supervisor by name, email, expertise..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                    <SelectTrigger className="w-[190px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="accepting">Accepting intake</SelectItem>
                      <SelectItem value="paused">Intake paused</SelectItem>
                      <SelectItem value="slow">Flagged response &gt;7d</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supervisor Controls</CardTitle>
                <CardDescription>
                  Capacity control, intake pause/resume, response performance and nudges
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredSupervisors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supervisors found.</p>
                ) : (
                  filteredSupervisors.map((sup) => (
                    <div key={sup.userId} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{sup.fullName}</p>
                            <Badge variant="outline">{sup.status}</Badge>
                            {!sup.acceptingStudents && (
                              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                                Intake Paused
                              </Badge>
                            )}
                            {sup.responseTimeFlag && (
                              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                                Slow Response
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{sup.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Requests pending: {sup.pendingRequests} | Avg response:{" "}
                            {sup.avgResponseDays === null ? "N/A" : `${sup.avgResponseDays.toFixed(1)} days`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {sup.expertise.length > 0 ? (
                              sup.expertise.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No expertise tags.</span>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={sup.currentStudents}
                              value={capacityDrafts[sup.userId] ?? String(sup.maxCapacity)}
                              onChange={(e) =>
                                setCapacityDrafts((prev) => ({
                                  ...prev,
                                  [sup.userId]: e.target.value,
                                }))
                              }
                              className="w-24"
                            />
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                const value = Number(capacityDrafts[sup.userId] ?? sup.maxCapacity)
                                if (!Number.isFinite(value)) return
                                void runAction(
                                  {
                                    action: "update_capacity",
                                    supervisorId: sup.userId,
                                    maxCapacity: Math.max(sup.currentStudents, Math.floor(value)),
                                  },
                                  `Updated capacity for ${sup.fullName}.`
                                )
                              }}
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                {
                                  action: "set_intake",
                                  supervisorId: sup.userId,
                                  acceptingStudents: !sup.acceptingStudents,
                                },
                                `${sup.acceptingStudents ? "Paused" : "Resumed"} intake for ${sup.fullName}.`
                              )
                            }
                          >
                            {sup.acceptingStudents ? (
                              <>
                                <PauseCircle className="mr-2 h-4 w-4" />
                                Pause Intake
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Resume Intake
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                {
                                  action: "send_workload_nudge",
                                  supervisorIds: [sup.userId],
                                },
                                `Sent workload nudge to ${sup.fullName}.`
                              )
                            }
                          >
                            <Bell className="mr-2 h-4 w-4" />
                            Send Nudge
                          </Button>
                          <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                            Load: {sup.currentStudents}/{sup.maxCapacity} ({pct(sup.currentStudents, sup.maxCapacity)}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Force Assign / Reassign</CardTitle>
                <CardDescription>
                  Admin override to manually pair a student with a supervisor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableStudents.map((student) => (
                      <SelectItem key={student.userId} value={student.userId}>
                        {student.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={targetSupervisorId} onValueChange={setTargetSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSupervisors.map((sup) => (
                      <SelectItem key={sup.userId} value={sup.userId}>
                        {sup.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={busy || !selectedStudentId || !targetSupervisorId}
                  onClick={() =>
                    void runAction(
                      {
                        action: "assign_student",
                        studentId: selectedStudentId,
                        toSupervisorId: targetSupervisorId,
                      },
                      "Student assignment updated."
                    )
                  }
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Assign Student
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reassign All Students</CardTitle>
                <CardDescription>
                  Bulk transfer when a supervisor leaves or becomes unavailable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={fromSupervisorId} onValueChange={setFromSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="From supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSupervisors.map((sup) => (
                      <SelectItem key={sup.userId} value={sup.userId}>
                        {sup.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={toSupervisorId} onValueChange={setToSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="To supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSupervisors
                      .filter((sup) => sup.userId !== fromSupervisorId)
                      .map((sup) => (
                        <SelectItem key={sup.userId} value={sup.userId}>
                          {sup.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy || !fromSupervisorId || !toSupervisorId}
                  onClick={() =>
                    void runAction(
                      {
                        action: "reassign_all_students",
                        fromSupervisorId,
                        toSupervisorId,
                      },
                      "Bulk reassignment completed."
                    )
                  }
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Reassign All
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending Supervisor Applications</CardTitle>
                <CardDescription>
                  Approve pending supervisors to activate their account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingApplications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending supervisor applications.</p>
                ) : (
                  pendingApplications.map((item) => (
                    <div key={item.userId} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{item.fullName}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Applied {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            { action: "approve_supervisor", userId: item.userId },
                            `Approved ${item.fullName}.`
                          )
                        }
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Approve Supervisor
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Nudge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      { action: "send_workload_nudge" },
                      "Sent workload balancing nudges."
                    )
                  }
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Nudge All Supervisors
                </Button>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Overloaded supervisors get a pause-intake nudge; underloaded supervisors are prompted to review pending requests.
                </p>
                {summary.flaggedResponseTime > 0 && (
                  <p className="text-xs text-warning">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {summary.flaggedResponseTime} supervisor(s) flagged for response time over 7 days.
                  </p>
                )}
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
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
