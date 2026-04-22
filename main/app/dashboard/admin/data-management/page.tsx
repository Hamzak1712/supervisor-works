"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Archive,
  Database,
  Download,
  FileDown,
  FileUp,
  History,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react"
import type { User } from "@/types"

type DataManagementPayload = {
  config: {
    id: string
    autoBackupEnabled: boolean
    backupFrequency: "HOURLY" | "DAILY" | "WEEKLY"
    backupRetentionDays: number
    piiMaskBackups: boolean
    completedProjectRetentionDays: number
    messageRetentionDays: number
    auditLogRetentionDays: number
    updatedAt: string
  }
  summary: {
    users: number
    students: number
    supervisors: number
    admins: number
    projects: number
    milestones: number
    requests: number
    messages: number
    meetings: number
    notifications: number
    backups: number
    importJobs: number
  }
  backups: Array<{
    id: string
    type: "MANUAL" | "AUTOMATED"
    status: "IN_PROGRESS" | "COMPLETED" | "FAILED"
    format: "json" | "sql"
    piiMasked: boolean
    recordCount: number
    sizeBytes: number
    createdByEmail: string | null
    createdAt: string
    restoredAt: string | null
  }>
  imports: Array<{
    id: string
    entityType: string
    status: string
    processedCount: number
    createdCount: number
    updatedCount: number
    failedCount: number
    createdAt: string
  }>
  audits: Array<{
    id: string
    action: string
    actorEmail: string | null
    createdAt: string
    metadata: unknown
  }>
  academicPeriods: Array<{
    id: string
    name: string
    isActive: boolean
    isArchived: boolean
  }>
  importResult?: {
    processedCount: number
    createdCount: number
    updatedCount: number
    failedCount: number
    errors: string[]
  }
  cleanupResult?: {
    projectsDeleted: number
    messagesDeleted: number
    auditDeleted: number
  }
  purgeResult?: {
    deletedCount: number
  }
  matchingResetResult?: {
    deletedCount: number
  }
  requestsPurgeResult?: {
    deletedCount: number
  }
  periodDeleteResult?: {
    deletedProjects: number
    deletedMilestones: number
    deletedRequests: number
    deletedRescheduleEvents: number
  }
  forcedLogoutResult?: {
    affectedUsers: number
  }
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toMb(value: number) {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export default function AdminDataManagementPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [payload, setPayload] = useState<DataManagementPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [backupFrequency, setBackupFrequency] = useState<"HOURLY" | "DAILY" | "WEEKLY">("DAILY")
  const [backupRetentionDays, setBackupRetentionDays] = useState("30")
  const [piiMaskBackups, setPiiMaskBackups] = useState(true)
  const [projectRetentionDays, setProjectRetentionDays] = useState("365")
  const [messageRetentionDays, setMessageRetentionDays] = useState("365")
  const [auditRetentionDays, setAuditRetentionDays] = useState("730")

  const [manualBackupFormat, setManualBackupFormat] = useState<"json" | "sql">("json")
  const [manualBackupPiiMask, setManualBackupPiiMask] = useState(true)
  const [backupProgress, setBackupProgress] = useState(0)

  const [selectedBackupId, setSelectedBackupId] = useState("")
  const [restoreConfirm, setRestoreConfirm] = useState("")
  const [restoreReason, setRestoreReason] = useState("")

  const [importEntityType, setImportEntityType] = useState<"students" | "supervisors" | "projects">(
    "students"
  )
  const [importCsv, setImportCsv] = useState("")

  const [exportFormat, setExportFormat] = useState<"json" | "sql">("json")
  const [exportPiiMask, setExportPiiMask] = useState(true)

  const [purgeDays, setPurgeDays] = useState("180")
  const [purgeConfirm, setPurgeConfirm] = useState("")
  const [purgeReason, setPurgeReason] = useState("")

  const [factoryResetConfirm, setFactoryResetConfirm] = useState("")
  const [factoryResetReason, setFactoryResetReason] = useState("")
  const [matchingResetConfirm, setMatchingResetConfirm] = useState("")
  const [matchingResetReason, setMatchingResetReason] = useState("")
  const [requestPurgeDays, setRequestPurgeDays] = useState("60")
  const [requestPurgeConfirm, setRequestPurgeConfirm] = useState("")
  const [requestPurgeReason, setRequestPurgeReason] = useState("")
  const [deletePeriodId, setDeletePeriodId] = useState("")
  const [deletePeriodConfirm, setDeletePeriodConfirm] = useState("")
  const [deletePeriodReason, setDeletePeriodReason] = useState("")
  const [logoutAllConfirm, setLogoutAllConfirm] = useState("")
  const [logoutAllReason, setLogoutAllReason] = useState("")

  const authHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  function hydrate(next: DataManagementPayload) {
    setPayload(next)
    setAutoBackupEnabled(next.config.autoBackupEnabled)
    setBackupFrequency(next.config.backupFrequency)
    setBackupRetentionDays(String(next.config.backupRetentionDays))
    setPiiMaskBackups(next.config.piiMaskBackups)
    setManualBackupPiiMask(next.config.piiMaskBackups)
    setExportPiiMask(next.config.piiMaskBackups)
    setProjectRetentionDays(String(next.config.completedProjectRetentionDays))
    setMessageRetentionDays(String(next.config.messageRetentionDays))
    setAuditRetentionDays(String(next.config.auditLogRetentionDays))
    if (!selectedBackupId && next.backups[0]?.id) {
      setSelectedBackupId(next.backups[0].id)
    }
    if (!deletePeriodId) {
      const nonActive = next.academicPeriods.find((period) => !period.isActive)
      setDeletePeriodId(nonActive?.id || next.academicPeriods[0]?.id || "")
    }
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, dmRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/data-management", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const meData = await meRes.json()
      const dmData = (await dmRes.json()) as DataManagementPayload | { error?: string }

      if (!dmRes.ok || !("config" in dmData)) {
        throw new Error((dmData as { error?: string })?.error || "Failed to load data management")
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

      hydrate(dmData)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load data management.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runJsonAction(
    body: Record<string, unknown>,
    successMessage: string,
    showBusy = true
  ) {
    try {
      if (showBusy) setBusy(true)
      setError("")

      const res = await fetch("/api/admin/data-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as DataManagementPayload | { error?: string }
      if (!res.ok || !("config" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      hydrate(data)
      setNotice(successMessage)
      window.setTimeout(() => setNotice(""), 3000)
      return data
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Action failed.")
      return null
    } finally {
      if (showBusy) setBusy(false)
    }
  }

  async function updateSettings() {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/data-management", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          autoBackupEnabled,
          backupFrequency,
          backupRetentionDays: Number(backupRetentionDays),
          piiMaskBackups,
          completedProjectRetentionDays: Number(projectRetentionDays),
          messageRetentionDays: Number(messageRetentionDays),
          auditLogRetentionDays: Number(auditRetentionDays),
        }),
      })

      const data = (await res.json()) as DataManagementPayload | { error?: string }
      if (!res.ok || !("config" in data)) {
        throw new Error((data as { error?: string })?.error || "Failed to update settings")
      }

      hydrate(data)
      setNotice("Data management policy updated.")
      window.setTimeout(() => setNotice(""), 2500)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update settings.")
    } finally {
      setBusy(false)
    }
  }

  async function createManualBackup() {
    setBackupProgress(10)
    const ticker = window.setInterval(() => {
      setBackupProgress((prev) => (prev >= 90 ? prev : prev + 12))
    }, 300)

    const result = await runJsonAction(
      {
        action: "create_backup",
        format: manualBackupFormat,
        piiMasked: manualBackupPiiMask,
      },
      "Manual backup completed."
    )

    window.clearInterval(ticker)
    setBackupProgress(100)
    window.setTimeout(() => setBackupProgress(0), 700)

    if (result?.backups?.[0]?.id) {
      setSelectedBackupId(result.backups[0].id)
    }
  }

  async function downloadBackup(backupId: string, format: "json" | "sql") {
    try {
      setBusy(true)
      setError("")
      const res = await fetch(
        `/api/admin/data-management?downloadId=${encodeURIComponent(
          backupId
        )}&format=${encodeURIComponent(format)}`,
        {
          headers: authHeaders(),
        }
      )

      if (!res.ok) {
        let message = "Download failed"
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
      anchor.download = `backup-${backupId}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setNotice(`Backup ${backupId} downloaded.`)
      window.setTimeout(() => setNotice(""), 2500)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not download backup.")
    } finally {
      setBusy(false)
    }
  }

  async function runBulkExport() {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/data-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          action: "bulk_export",
          format: exportFormat,
          piiMasked: exportPiiMask,
        }),
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
      anchor.download = `platform-export.${exportFormat}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setNotice("Full data export downloaded.")
      window.setTimeout(() => setNotice(""), 2500)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not export data.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchData(true)
  }, [])

  const selectedBackup = useMemo(() => {
    if (!payload) return null
    return payload.backups.find((item) => item.id === selectedBackupId) || null
  }, [payload, selectedBackupId])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Data Management">
        <div className="p-6">Loading data management...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Data Management">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Data Management</h2>
            <p className="text-sm text-muted-foreground">
              Backup, restore, import/export, retention, and danger-zone controls.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void fetchData()} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={updateSettings} disabled={busy}>
              Save Policy
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Database} label="Users" value={payload.summary.users} />
          <StatCard icon={Archive} label="Backups" value={payload.summary.backups} />
          <StatCard icon={Upload} label="Import Jobs" value={payload.summary.importJobs} />
          <StatCard icon={History} label="Messages" value={payload.summary.messages} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Backup Configuration</CardTitle>
                <CardDescription>
                  Set auto-backup frequency, retention window, and backup masking policy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Automated backups</Label>
                    <p className="text-xs text-muted-foreground">Enable scheduled backup jobs.</p>
                  </div>
                  <Switch checked={autoBackupEnabled} onCheckedChange={setAutoBackupEnabled} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={backupFrequency}
                      onValueChange={(value: "HOURLY" | "DAILY" | "WEEKLY") =>
                        setBackupFrequency(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOURLY">Hourly</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Backup retention (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={backupRetentionDays}
                      onChange={(event) => setBackupRetentionDays(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mask PII in backups</Label>
                    <div className="flex h-10 items-center rounded-md border px-3">
                      <Switch checked={piiMaskBackups} onCheckedChange={setPiiMaskBackups} />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {piiMaskBackups ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manual Backup + Full Export</CardTitle>
                <CardDescription>
                  Create an on-demand snapshot, then download JSON/SQL exports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Manual backup format</Label>
                    <Select
                      value={manualBackupFormat}
                      onValueChange={(value: "json" | "sql") => setManualBackupFormat(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="sql">SQL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mask PII</Label>
                    <div className="flex h-10 items-center rounded-md border px-3">
                      <Switch checked={manualBackupPiiMask} onCheckedChange={setManualBackupPiiMask} />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {manualBackupPiiMask ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={createManualBackup} disabled={busy} className="w-full">
                      <Archive className="mr-2 h-4 w-4" />
                      Create Backup
                    </Button>
                  </div>
                </div>
                {backupProgress > 0 && (
                  <div className="space-y-1">
                    <Progress value={backupProgress} />
                    <p className="text-xs text-muted-foreground">Backup progress: {backupProgress}%</p>
                  </div>
                )}
                <Separator />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Export format</Label>
                    <Select
                      value={exportFormat}
                      onValueChange={(value: "json" | "sql") => setExportFormat(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="sql">SQL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mask PII in export</Label>
                    <div className="flex h-10 items-center rounded-md border px-3">
                      <Switch checked={exportPiiMask} onCheckedChange={setExportPiiMask} />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {exportPiiMask ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={runBulkExport} disabled={busy} className="w-full">
                      <FileDown className="mr-2 h-4 w-4" />
                      Export Full Snapshot
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup History + Restore</CardTitle>
                <CardDescription>
                  Restore requires confirmation phrase and reason. Masked backups cannot be restored.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {payload.backups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No backups yet.</p>
                  )}
                  {payload.backups.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium">{item.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.createdAt)} • {item.recordCount} records • {toMb(item.sizeBytes)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.type}</Badge>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "COMPLETED"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                : item.status === "IN_PROGRESS"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                                  : "border-destructive/30 bg-destructive/10 text-destructive"
                            }
                          >
                            {item.status}
                          </Badge>
                          {item.piiMasked && <Badge variant="secondary">PII masked</Badge>}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void downloadBackup(item.id, item.format)}
                            disabled={busy || item.status !== "COMPLETED"}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Backup to restore</Label>
                    <Select value={selectedBackupId} onValueChange={setSelectedBackupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select backup" />
                      </SelectTrigger>
                      <SelectContent>
                        {payload.backups.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Input
                      value={restoreReason}
                      onChange={(event) => setRestoreReason(event.target.value)}
                      placeholder="Why restore this backup?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm with RESTORE</Label>
                    <Input
                      value={restoreConfirm}
                      onChange={(event) => setRestoreConfirm(event.target.value)}
                      placeholder="RESTORE"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !selectedBackupId}
                  onClick={() =>
                    void runJsonAction(
                      {
                        action: "restore_backup",
                        backupId: selectedBackupId,
                        reason: restoreReason,
                        confirmPhrase: restoreConfirm,
                      },
                      "Backup restore completed."
                    )
                  }
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restore Selected Backup
                </Button>
                {selectedBackup?.piiMasked && (
                  <p className="text-xs text-amber-600">
                    Selected backup is PII-masked and cannot be used for restore.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Import</CardTitle>
                <CardDescription>
                  Import CSV for students, supervisors, or projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Entity type</Label>
                    <Select
                      value={importEntityType}
                      onValueChange={(value: "students" | "supervisors" | "projects") =>
                        setImportEntityType(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="students">Students</SelectItem>
                        <SelectItem value="supervisors">Supervisors</SelectItem>
                        <SelectItem value="projects">Projects</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>CSV file</Label>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        void file.text().then((text) => setImportCsv(text))
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CSV content</Label>
                  <Textarea
                    value={importCsv}
                    onChange={(event) => setImportCsv(event.target.value)}
                    placeholder='email,fullName,skills,interests,status'
                    className="min-h-[140px]"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    void runJsonAction(
                      {
                        action: "bulk_import",
                        entityType: importEntityType,
                        csv: importCsv,
                      },
                      "Bulk import completed."
                    )
                  }
                  disabled={busy || !importCsv.trim()}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Run Import
                </Button>
                {payload.importResult && (
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <p>
                      Processed {payload.importResult.processedCount}, created {payload.importResult.createdCount},
                      updated {payload.importResult.updatedCount}, failed {payload.importResult.failedCount}.
                    </p>
                    {payload.importResult.errors.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {payload.importResult.errors.join(" | ")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Retention Policy</CardTitle>
                <CardDescription>Automatic deletion windows by dataset type.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Completed projects (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={projectRetentionDays}
                    onChange={(event) => setProjectRetentionDays(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Messages (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={messageRetentionDays}
                    onChange={(event) => setMessageRetentionDays(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audit logs (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={auditRetentionDays}
                    onChange={(event) => setAuditRetentionDays(event.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => void runJsonAction({ action: "run_retention_cleanup" }, "Retention cleanup completed.")}
                  disabled={busy}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Run Cleanup Now
                </Button>
                {payload.cleanupResult && (
                  <p className="text-xs text-muted-foreground">
                    Deleted {payload.cleanupResult.projectsDeleted} projects, {payload.cleanupResult.messagesDeleted}{" "}
                    messages, {payload.cleanupResult.auditDeleted} audit logs.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purge Inactive Users</CardTitle>
                <CardDescription>Delete stale pending/suspended non-admin users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Inactive for at least (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={purgeDays}
                    onChange={(event) => setPurgeDays(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={purgeReason}
                    onChange={(event) => setPurgeReason(event.target.value)}
                    placeholder="Maintenance cleanup reason"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type PURGE</Label>
                  <Input
                    value={purgeConfirm}
                    onChange={(event) => setPurgeConfirm(event.target.value)}
                    placeholder="PURGE"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    void runJsonAction(
                      {
                        action: "purge_inactive_users",
                        daysInactive: Number(purgeDays),
                        reason: purgeReason,
                        confirmPhrase: purgeConfirm,
                      },
                      "Inactive user purge completed."
                    )
                  }
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Purge Inactive
                </Button>
                {payload.purgeResult && (
                  <p className="text-xs text-muted-foreground">
                    Deleted {payload.purgeResult.deletedCount} inactive users.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Recent Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.audits.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data-management audit entries yet.</p>
                )}
                {payload.audits.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-2 text-xs">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-muted-foreground">
                      {entry.actorEmail || "system"} • {formatDate(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible operations. Every action requires typed confirmation and is audit logged.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  This action is destructive and should only be used for test/demo environment resets.
                </div>
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-background p-3">
                  <p className="text-sm font-medium">Reset all matching recommendations</p>
                  <Input
                    value={matchingResetReason}
                    onChange={(event) => setMatchingResetReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <Input
                    value={matchingResetConfirm}
                    onChange={(event) => setMatchingResetConfirm(event.target.value)}
                    placeholder="Type RESET MATCHING"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={busy}
                    onClick={() =>
                      void runJsonAction(
                        {
                          action: "reset_matching_recommendations",
                          reason: matchingResetReason,
                          confirmPhrase: matchingResetConfirm,
                        },
                        "Matching recommendations reset."
                      )
                    }
                  >
                    Reset Matching Recommendations
                  </Button>
                  {payload.matchingResetResult && (
                    <p className="text-xs text-muted-foreground">
                      Deleted {payload.matchingResetResult.deletedCount} recommendation rows.
                    </p>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-background p-3">
                  <p className="text-sm font-medium">Purge old declined/withdrawn/expired requests</p>
                  <Input
                    type="number"
                    min={1}
                    value={requestPurgeDays}
                    onChange={(event) => setRequestPurgeDays(event.target.value)}
                    placeholder="Days old"
                  />
                  <Input
                    value={requestPurgeReason}
                    onChange={(event) => setRequestPurgeReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <Input
                    value={requestPurgeConfirm}
                    onChange={(event) => setRequestPurgeConfirm(event.target.value)}
                    placeholder="Type PURGE REQUESTS"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={busy}
                    onClick={() =>
                      void runJsonAction(
                        {
                          action: "purge_old_requests",
                          daysOld: Number(requestPurgeDays),
                          reason: requestPurgeReason,
                          confirmPhrase: requestPurgeConfirm,
                        },
                        "Old request records purged."
                      )
                    }
                  >
                    Purge Old Requests
                  </Button>
                  {payload.requestsPurgeResult && (
                    <p className="text-xs text-muted-foreground">
                      Deleted {payload.requestsPurgeResult.deletedCount} request rows.
                    </p>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-background p-3">
                  <p className="text-sm font-medium">Delete academic period and linked project data</p>
                  <Select value={deletePeriodId} onValueChange={setDeletePeriodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {payload.academicPeriods.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.name}
                          {period.isActive ? " (active)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={deletePeriodReason}
                    onChange={(event) => setDeletePeriodReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <Input
                    value={deletePeriodConfirm}
                    onChange={(event) => setDeletePeriodConfirm(event.target.value)}
                    placeholder="Type DELETE PERIOD"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={busy || !deletePeriodId}
                    onClick={() =>
                      void runJsonAction(
                        {
                          action: "delete_academic_period",
                          periodId: deletePeriodId,
                          reason: deletePeriodReason,
                          confirmPhrase: deletePeriodConfirm,
                        },
                        "Academic period deleted."
                      )
                    }
                  >
                    Delete Period + Data
                  </Button>
                  {payload.periodDeleteResult && (
                    <p className="text-xs text-muted-foreground">
                      Deleted projects {payload.periodDeleteResult.deletedProjects}, milestones{" "}
                      {payload.periodDeleteResult.deletedMilestones}, requests{" "}
                      {payload.periodDeleteResult.deletedRequests}.
                    </p>
                  )}
                </div>
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-background p-3">
                  <p className="text-sm font-medium">Force logout every user</p>
                  <Input
                    value={logoutAllReason}
                    onChange={(event) => setLogoutAllReason(event.target.value)}
                    placeholder="Reason"
                  />
                  <Input
                    value={logoutAllConfirm}
                    onChange={(event) => setLogoutAllConfirm(event.target.value)}
                    placeholder="Type LOGOUT ALL"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={busy}
                    onClick={() =>
                      void runJsonAction(
                        {
                          action: "force_logout_all_users",
                          reason: logoutAllReason,
                          confirmPhrase: logoutAllConfirm,
                        },
                        "All sessions invalidated."
                      )
                    }
                  >
                    Force Logout All Users
                  </Button>
                  {payload.forcedLogoutResult && (
                    <p className="text-xs text-muted-foreground">
                      Invalidated sessions for {payload.forcedLogoutResult.affectedUsers} users.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={factoryResetReason}
                    onChange={(event) => setFactoryResetReason(event.target.value)}
                    placeholder="Why reset this environment?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type FACTORY RESET</Label>
                  <Input
                    value={factoryResetConfirm}
                    onChange={(event) => setFactoryResetConfirm(event.target.value)}
                    placeholder="FACTORY RESET"
                  />
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    void runJsonAction(
                      {
                        action: "factory_reset",
                        reason: factoryResetReason,
                        confirmPhrase: factoryResetConfirm,
                      },
                      "Factory reset completed."
                    )
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Factory Reset
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />
        <Card>
          <CardHeader>
            <CardTitle>Import Job History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.imports.length === 0 && (
              <p className="text-sm text-muted-foreground">No import jobs yet.</p>
            )}
            {payload.imports.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <p className="font-medium">
                    {item.entityType} • {item.status}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Processed {item.processedCount}, created {item.createdCount}, updated {item.updatedCount}, failed{" "}
                  {item.failedCount}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
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
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}
