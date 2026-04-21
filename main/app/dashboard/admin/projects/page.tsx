"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  AlertTriangle,
  Calendar,
  CheckCircle2,
  History,
  Lock,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react"

type ProjectListItem = {
  id: string
  title: string | null
  description: string | null
  status: string
  phase: "planning" | "execution" | "finalization" | "completed" | "closed"
  atRisk: boolean
  timelineLocked: boolean
  timelineLockedAt: string | null
  timelineLockReason: string | null
  createdAt: string
  updatedAt: string
  student: {
    id: string
    email: string
    fullName: string
  }
  supervisor: {
    id: string
    email: string
    fullName: string
  } | null
  stats: {
    totalMilestones: number
    completedCount: number
    inProgressCount: number
    delayedCount: number
    nextDueDate: string | null
  }
}

type MilestoneItem = {
  id: string
  projectId: string
  title: string
  description: string | null
  dueDate: string
  status: string
  isCriticalPath: boolean
  feedback: string | null
}

type RescheduleEvent = {
  id: string
  triggerType: string
  triggeredByUserId: string | null
  anchorMilestoneId: string | null
  shiftDaysRequested: number
  shiftDaysApplied: number
  rescheduledCount: number
  warnings: unknown
  createdAt: string
}

type ProjectsPayload = {
  projects: ProjectListItem[]
  supervisors: Array<{
    id: string
    fullName: string
    email: string
  }>
  selectedProject: {
    id: string
    title: string | null
    description: string | null
    status: string
    timelineLocked: boolean
    timelineLockedAt: string | null
    timelineLockReason: string | null
    createdAt: string
    updatedAt: string
    student: {
      id: string
      email: string
      studentProfile: {
        fullName: string | null
      } | null
    }
    milestones: MilestoneItem[]
    rescheduleEvents: RescheduleEvent[]
  } | null
}

type MilestoneDraft = {
  title: string
  description: string
  dueDate: string
  status: string
  isCriticalPath: boolean
  feedback: string
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export default function AdminProjectsPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [payload, setPayload] = useState<ProjectsPayload | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [statusDraft, setStatusDraft] = useState("active")
  const [lockReason, setLockReason] = useState("")
  const [shiftDays, setShiftDays] = useState("7")
  const [anchorMilestoneId, setAnchorMilestoneId] = useState("")
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("")
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("")
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("")
  const [newMilestoneStatus, setNewMilestoneStatus] = useState("pending")
  const [newMilestoneCritical, setNewMilestoneCritical] = useState(false)
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, MilestoneDraft>>({})

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [phaseFilter, setPhaseFilter] = useState("all")
  const [supervisorFilter, setSupervisorFilter] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")

  function hydrate(next: ProjectsPayload, keepSelected = true) {
    setPayload(next)

    const nextSelectedId =
      (keepSelected &&
        selectedProjectId &&
        next.projects.some((item) => item.id === selectedProjectId) &&
        selectedProjectId) ||
      next.selectedProject?.id ||
      next.projects[0]?.id ||
      ""

    setSelectedProjectId(nextSelectedId)

    const selected =
      (next.selectedProject && next.selectedProject.id === nextSelectedId
        ? next.selectedProject
        : null) ||
      null

    if (selected) {
      setStatusDraft(selected.status)
      setLockReason(selected.timelineLockReason || "")
      const drafts: Record<string, MilestoneDraft> = {}
      selected.milestones.forEach((item) => {
        drafts[item.id] = {
          title: item.title,
          description: item.description || "",
          dueDate: toDateInput(item.dueDate),
          status: item.status,
          isCriticalPath: item.isCriticalPath,
          feedback: item.feedback || "",
        }
      })
      setMilestoneDrafts(drafts)
      setAnchorMilestoneId(selected.milestones[0]?.id || "")
    } else {
      setMilestoneDrafts({})
      setAnchorMilestoneId("")
    }
  }

  async function fetchData(projectId?: string, showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const queryPart = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""

      const [meRes, projectsRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`/api/admin/projects${queryPart}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const projectsData = (await projectsRes.json()) as ProjectsPayload | { error?: string }

      if (!projectsRes.ok || !("projects" in projectsData)) {
        throw new Error((projectsData as { error?: string })?.error || "Failed to load projects")
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

      hydrate(projectsData, !projectId)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load projects.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(
    body: Record<string, unknown>,
    successNotice: string,
    projectIdForRefresh?: string
  ) {
    try {
      setBusy(true)
      setError("")

      const token = localStorage.getItem("token")
      const res = await fetch("/api/admin/projects", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as ProjectsPayload | { error?: string }

      if (!res.ok || !("projects" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)
      setNotice(successNotice)
      window.setTimeout(() => setNotice(""), 2500)

      if (projectIdForRefresh || selectedProjectId) {
        await fetchData(projectIdForRefresh || selectedProjectId)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchData(undefined, true)
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    void fetchData(selectedProjectId)
  }, [selectedProjectId])

  const filteredProjects = useMemo(() => {
    if (!payload) return []
    return payload.projects.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      if (phaseFilter !== "all" && item.phase !== phaseFilter) return false
      if (supervisorFilter !== "all" && item.supervisor?.id !== supervisorFilter) return false
      if (riskFilter !== "all") {
        const expected = riskFilter === "true"
        if (item.atRisk !== expected) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        const values = [
          item.title || "",
          item.student.fullName,
          item.student.email,
          item.supervisor?.fullName || "",
          item.supervisor?.email || "",
          item.status,
          item.phase,
        ]
        if (!values.some((value) => value.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [payload, query, statusFilter, phaseFilter, supervisorFilter, riskFilter])

  const selectedProject =
    payload?.selectedProject && payload.selectedProject.id === selectedProjectId
      ? payload.selectedProject
      : null

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Project Oversight">
        <div className="p-6">Loading project oversight...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Project Oversight">
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

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter by status, supervisor, phase, and at-risk state.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Input
              placeholder="Search project/student/supervisor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_supervisor">Pending supervisor</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All supervisors</SelectItem>
                {payload.supervisors.map((supervisor) => (
                  <SelectItem key={supervisor.id} value={supervisor.id}>
                    {supervisor.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="execution">Execution</SelectItem>
                <SelectItem value="finalization">Finalization</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">At-risk only</SelectItem>
                <SelectItem value="false">Not at-risk</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void fetchData(selectedProjectId)}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Projects ({filteredProjects.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects match current filters.</p>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedProjectId === project.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/40"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold">
                      {project.title || "Untitled Project"}
                    </p>
                    <p className="text-xs text-muted-foreground">{project.student.fullName}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {project.status}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {project.phase}
                      </Badge>
                      {project.atRisk && (
                        <Badge variant="destructive" className="text-[10px]">
                          At-risk
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6 xl:col-span-2">
            {!selectedProject ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Select a project to inspect and manage timeline controls.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedProject.title || "Untitled Project"}</CardTitle>
                    <CardDescription>
                      Student:{" "}
                      {selectedProject.student.studentProfile?.fullName ||
                        selectedProject.student.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Project status</Label>
                        <Select value={statusDraft} onValueChange={setStatusDraft}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending_supervisor">Pending supervisor</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="abandoned">Abandoned</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Timeline lock reason</Label>
                        <Input
                          value={lockReason}
                          onChange={(e) => setLockReason(e.target.value)}
                          placeholder="Optional reason"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            {
                              action: "set_project_status",
                              projectId: selectedProject.id,
                              status: statusDraft,
                            },
                            "Project status updated.",
                            selectedProject.id
                          )
                        }
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Status
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            {
                              action: "set_timeline_lock",
                              projectId: selectedProject.id,
                              locked: !selectedProject.timelineLocked,
                              reason: lockReason,
                            },
                            selectedProject.timelineLocked
                              ? "Timeline unlocked."
                              : "Timeline locked.",
                            selectedProject.id
                          )
                        }
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {selectedProject.timelineLocked ? "Unlock Timeline" : "Lock Timeline"}
                      </Button>
                    </div>
                    {selectedProject.timelineLocked && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                        <p className="font-medium text-amber-700">
                          Timeline is locked
                        </p>
                        <p className="text-muted-foreground">
                          {selectedProject.timelineLockReason || "Locked by admin."}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Force Rescheduling</CardTitle>
                    <CardDescription>
                      Trigger recalculation manually after supervisor or scope changes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Shift days</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={shiftDays}
                        onChange={(e) => setShiftDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Anchor milestone</Label>
                      <Select value={anchorMilestoneId} onValueChange={setAnchorMilestoneId}>
                        <SelectTrigger>
                          <SelectValue placeholder="First active milestone" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedProject.milestones.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            {
                              action: "force_reschedule",
                              projectId: selectedProject.id,
                              shiftDays: Number(shiftDays) || 7,
                              anchorMilestoneId: anchorMilestoneId || undefined,
                            },
                            "Forced rescheduling completed.",
                            selectedProject.id
                          )
                        }
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Force Reschedule
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Timeline Override</CardTitle>
                    <CardDescription>
                      Insert, edit, and delete milestones manually.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                      <Input
                        placeholder="New milestone title"
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      />
                      <Input
                        type="date"
                        value={newMilestoneDueDate}
                        onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                      />
                      <Select value={newMilestoneStatus} onValueChange={setNewMilestoneStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="in_progress">in_progress</SelectItem>
                          <SelectItem value="completed">completed</SelectItem>
                          <SelectItem value="delayed">delayed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={newMilestoneCritical ? "yes" : "no"}
                        onValueChange={(value) => setNewMilestoneCritical(value === "yes")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">Not critical</SelectItem>
                          <SelectItem value="yes">Critical path</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="md:col-span-2">
                        <Textarea
                          rows={2}
                          placeholder="Description (optional)"
                          value={newMilestoneDescription}
                          onChange={(e) => setNewMilestoneDescription(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              {
                                action: "add_milestone",
                                projectId: selectedProject.id,
                                title: newMilestoneTitle,
                                description: newMilestoneDescription,
                                dueDate: newMilestoneDueDate,
                                status: newMilestoneStatus,
                                isCriticalPath: newMilestoneCritical,
                              },
                              "Milestone added.",
                              selectedProject.id
                            ).then(() => {
                              setNewMilestoneTitle("")
                              setNewMilestoneDescription("")
                              setNewMilestoneDueDate("")
                              setNewMilestoneStatus("pending")
                              setNewMilestoneCritical(false)
                            })
                          }
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Add Milestone
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {selectedProject.milestones.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No milestones yet.</p>
                      ) : (
                        selectedProject.milestones.map((item) => {
                          const draft = milestoneDrafts[item.id]
                          if (!draft) return null
                          return (
                            <div key={item.id} className="rounded-lg border p-3">
                              <div className="grid gap-2 md:grid-cols-3">
                                <Input
                                  value={draft.title}
                                  onChange={(e) =>
                                    setMilestoneDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, title: e.target.value },
                                    }))
                                  }
                                />
                                <Input
                                  type="date"
                                  value={draft.dueDate}
                                  onChange={(e) =>
                                    setMilestoneDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, dueDate: e.target.value },
                                    }))
                                  }
                                />
                                <Select
                                  value={draft.status}
                                  onValueChange={(value) =>
                                    setMilestoneDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { ...draft, status: value },
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">pending</SelectItem>
                                    <SelectItem value="in_progress">in_progress</SelectItem>
                                    <SelectItem value="completed">completed</SelectItem>
                                    <SelectItem value="delayed">delayed</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={draft.isCriticalPath ? "yes" : "no"}
                                  onValueChange={(value) =>
                                    setMilestoneDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...draft,
                                        isCriticalPath: value === "yes",
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">Not critical</SelectItem>
                                    <SelectItem value="yes">Critical path</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="md:col-span-2">
                                  <Input
                                    value={draft.description}
                                    placeholder="Description"
                                    onChange={(e) =>
                                      setMilestoneDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...draft,
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Input
                                    value={draft.feedback}
                                    placeholder="Feedback"
                                    onChange={(e) =>
                                      setMilestoneDrafts((prev) => ({
                                        ...prev,
                                        [item.id]: { ...draft, feedback: e.target.value },
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      {
                                        action: "update_milestone",
                                        milestoneId: item.id,
                                        title: draft.title,
                                        description: draft.description,
                                        dueDate: draft.dueDate,
                                        status: draft.status,
                                        isCriticalPath: draft.isCriticalPath,
                                        feedback: draft.feedback,
                                      },
                                      "Milestone updated.",
                                      selectedProject.id
                                    )
                                  }
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      {
                                        action: "delete_milestone",
                                        milestoneId: item.id,
                                        projectId: selectedProject.id,
                                      },
                                      "Milestone deleted.",
                                      selectedProject.id
                                    )
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Rescheduling History
                    </CardTitle>
                    <CardDescription>
                      All auto-shifts triggered for this project.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedProject.rescheduleEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No rescheduling events yet.</p>
                    ) : (
                      selectedProject.rescheduleEvents.map((event) => {
                        const warnings = normalizeWarnings(event.warnings)
                        return (
                          <div key={event.id} className="rounded-lg border p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{event.triggerType}</Badge>
                              <Badge variant="secondary">
                                {formatDate(event.createdAt)}
                              </Badge>
                              <Badge variant="secondary">
                                {event.shiftDaysApplied}d applied
                              </Badge>
                              <Badge variant="secondary">
                                {event.rescheduledCount} downstream
                              </Badge>
                            </div>
                            {warnings.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {warnings.map((warning, index) => (
                                  <p
                                    key={`${event.id}-${index}`}
                                    className="flex items-start gap-2 text-xs text-amber-700"
                                  >
                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                    {warning}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Mark project `completed`, `abandoned`, or `withdrawn`.
            </span>
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Timeline lock prevents all student timeline edits.
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Every auto-shift is logged in history for audit transparency.
            </span>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

