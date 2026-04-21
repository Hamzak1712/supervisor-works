"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Gauge,
  SlidersHorizontal,
  Sparkles,
  RefreshCcw,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react"

type MatchingSettings = {
  semanticWeight: number
  keywordWeight: number
  capacityWeight: number
  responseSpeedWeight: number
  minMatchThreshold: number
  recommendationCount: number
  aiExplanationEnabled: boolean
}

type MatchingPayload = {
  settings: MatchingSettings
  blacklist: Array<{
    id: string
    studentId: string
    supervisorId: string
    reason: string | null
    createdAt: string
    studentName: string
    studentEmail: string
    supervisorName: string
    supervisorEmail: string
  }>
  metrics: {
    eligibleCount: number
    top1Hits: number
    top3Hits: number
    top1Accuracy: number
    top3Accuracy: number
  }
  summary: {
    blacklistedPairs: number
    studentsWithRecommendations: number
  }
  students: Array<{
    id: string
    email: string
    fullName: string
  }>
  supervisors: Array<{
    id: string
    email: string
    fullName: string
  }>
  rerun?: {
    processedStudents?: number
    recomputedStudents?: number
    failedStudents?: number
    studentId?: string
    success?: boolean
  }
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

export default function AdminMatchingPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [payload, setPayload] = useState<MatchingPayload | null>(null)
  const [draft, setDraft] = useState<MatchingSettings | null>(null)

  const [rerunStudentId, setRerunStudentId] = useState("")
  const [blacklistStudentId, setBlacklistStudentId] = useState("")
  const [blacklistSupervisorId, setBlacklistSupervisorId] = useState("")
  const [blacklistReason, setBlacklistReason] = useState("")

  const authHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  function hydrate(data: MatchingPayload) {
    setPayload(data)
    setDraft(data.settings)
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, matchRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/matching", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const matchData = (await matchRes.json()) as MatchingPayload | { error?: string }

      if (!matchRes.ok || !("settings" in matchData)) {
        throw new Error((matchData as { error?: string })?.error || "Failed to load matching administration")
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

      hydrate(matchData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load matching administration")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(actionBody: Record<string, unknown>, noticeMessage: string) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/matching", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(actionBody),
      })

      const data = (await res.json()) as MatchingPayload | { error?: string }

      if (!res.ok || !("settings" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)
      setNotice(noticeMessage)
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
    }, 8000)

    return () => window.clearInterval(intervalId)
  }, [])

  const weightSum = useMemo(() => {
    if (!draft) return 0
    return (
      draft.semanticWeight +
      draft.keywordWeight +
      draft.capacityWeight +
      draft.responseSpeedWeight
    )
  }, [draft])

  const canSaveSettings = Boolean(draft && weightSum === 100 && !busy)

  if (loading || !payload || !draft) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Matching Administration">
        <div className="p-6">Loading matching administration...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Matching Administration">
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Target} label="Top-1 Accuracy" value={`${payload.metrics.top1Accuracy}%`} />
          <MetricCard icon={TrendingUp} label="Top-3 Accuracy" value={`${payload.metrics.top3Accuracy}%`} />
          <MetricCard icon={Gauge} label="Evaluated Cases" value={String(payload.metrics.eligibleCount)} />
          <MetricCard icon={ShieldAlert} label="Blacklisted Pairs" value={String(payload.summary.blacklistedPairs)} />
          <MetricCard icon={Sparkles} label="Students with Recs" value={String(payload.summary.studentsWithRecommendations)} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Matching Weight Tuning
                </CardTitle>
                <CardDescription>
                  Tune semantic similarity, keyword overlap, capacity fit, and response speed. Weights must sum to 100%.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WeightSlider
                  label="Semantic Similarity"
                  value={draft.semanticWeight}
                  onChange={(value) => setDraft((prev) => prev ? { ...prev, semanticWeight: value } : prev)}
                />
                <WeightSlider
                  label="Keyword Overlap"
                  value={draft.keywordWeight}
                  onChange={(value) => setDraft((prev) => prev ? { ...prev, keywordWeight: value } : prev)}
                />
                <WeightSlider
                  label="Capacity Fit"
                  value={draft.capacityWeight}
                  onChange={(value) => setDraft((prev) => prev ? { ...prev, capacityWeight: value } : prev)}
                />
                <WeightSlider
                  label="Response Speed"
                  value={draft.responseSpeedWeight}
                  onChange={(value) => setDraft((prev) => prev ? { ...prev, responseSpeedWeight: value } : prev)}
                />

                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Weight total</span>
                    <span className={weightSum === 100 ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>
                      {weightSum}%
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="threshold">Minimum Match Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min={0}
                      max={100}
                      value={draft.minMatchThreshold}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                minMatchThreshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                              }
                            : prev
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Recommendations Per Student</Label>
                    <Select
                      value={String(draft.recommendationCount)}
                      onValueChange={(value) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                recommendationCount: Number(value),
                              }
                            : prev
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Top 3</SelectItem>
                        <SelectItem value="5">Top 5</SelectItem>
                        <SelectItem value="8">Top 8</SelectItem>
                        <SelectItem value="10">Top 10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>AI Explanation</Label>
                    <Select
                      value={draft.aiExplanationEnabled ? "on" : "off"}
                      onValueChange={(value) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                aiExplanationEnabled: value === "on",
                              }
                            : prev
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">Enabled</SelectItem>
                        <SelectItem value="off">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    disabled={!canSaveSettings}
                    onClick={() =>
                      void runAction(
                        {
                          action: "update_settings",
                          ...draft,
                        },
                        "Matching settings updated."
                      )
                    }
                  >
                    Save Matching Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blacklist Pairings</CardTitle>
                <CardDescription>
                  Prevent specific student-supervisor pairs from ever appearing in recommendations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Select value={blacklistStudentId} onValueChange={setBlacklistStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={blacklistSupervisorId} onValueChange={setBlacklistSupervisorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Reason (optional)"
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  disabled={busy || !blacklistStudentId || !blacklistSupervisorId}
                  onClick={() =>
                    void runAction(
                      {
                        action: "add_blacklist",
                        studentId: blacklistStudentId,
                        supervisorId: blacklistSupervisorId,
                        reason: blacklistReason,
                      },
                      "Blacklist pairing saved."
                    )
                  }
                >
                  Add Blacklist Pair
                </Button>

                <Separator />

                <div className="space-y-2">
                  {payload.blacklist.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No blacklisted pairs yet.</p>
                  ) : (
                    payload.blacklist.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">
                          {item.studentName} {"->"} {item.supervisorName}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.reason || "No reason provided"}</p>
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                {
                                  action: "remove_blacklist",
                                  blacklistId: item.id,
                                },
                                "Blacklist pairing removed."
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Re-run Matching</CardTitle>
                <CardDescription>
                  Recompute recommendations globally or for one student.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      {
                        action: "rerun_global",
                      },
                      "Global matching re-run completed."
                    )
                  }
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Re-run Globally
                </Button>

                <Select value={rerunStudentId} onValueChange={setRerunStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student for single rerun" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload.students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy || !rerunStudentId}
                  onClick={() =>
                    void runAction(
                      {
                        action: "rerun_student",
                        studentId: rerunStudentId,
                      },
                      "Student-specific matching re-run completed."
                    )
                  }
                >
                  Re-run For Student
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evaluation Metrics</CardTitle>
                <CardDescription>
                  Dissertation-oriented evaluation snapshots from accepted requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <MetricRow label="Top-1 accuracy" value={`${payload.metrics.top1Accuracy}%`} />
                <MetricRow label="Top-3 accuracy" value={`${payload.metrics.top3Accuracy}%`} />
                <MetricRow label="Top-1 hits" value={String(payload.metrics.top1Hits)} />
                <MetricRow label="Top-3 hits" value={String(payload.metrics.top3Hits)} />
                <MetricRow label="Eligible cases" value={String(payload.metrics.eligibleCount)} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs font-medium text-muted-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
