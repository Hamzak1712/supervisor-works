"use client"

import { useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  currentAdmin,
  mockStudents,
  mockSupervisors,
  mockProjects,
  mockMilestones,
  mockSupervisionRequests,
} from "@/lib/mock-data"
import {
  Database,
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  FolderOpen,
  Users,
  Briefcase,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Archive,
  Layers,
  History,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Lock,
} from "lucide-react"

interface Dataset {
  key: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  count: number
  description: string
  sizeMb: number
  lastUpdated: string
  schemaVersion: string
  health: "healthy" | "stale" | "warning"
}

interface BackupEntry {
  id: string
  type: "automatic" | "manual"
  createdAt: string
  size: string
  status: "completed" | "in_progress" | "failed"
  records: number
}

export default function AdminDataManagementPage() {
  const [autoBackup, setAutoBackup] = useState(true)
  const [backupFrequency, setBackupFrequency] = useState("daily")
  const [retentionDays, setRetentionDays] = useState("30")
  const [piiMasking, setPiiMasking] = useState(true)
  const [exportFormat, setExportFormat] = useState("csv")

  const totalRecords =
    mockStudents.length +
    mockSupervisors.length +
    mockProjects.length +
    mockMilestones.length +
    mockSupervisionRequests.length

  const datasets: Dataset[] = [
    {
      key: "students",
      title: "Students",
      icon: GraduationCap,
      count: mockStudents.length,
      description: "Profiles, academic details, skills, interests, and supervision assignments.",
      sizeMb: 2.4,
      lastUpdated: "2 min ago",
      schemaVersion: "v3.2",
      health: "healthy",
    },
    {
      key: "supervisors",
      title: "Supervisors",
      icon: Briefcase,
      count: mockSupervisors.length,
      description: "Accounts, expertise tags, research areas, capacity, and past projects.",
      sizeMb: 1.8,
      lastUpdated: "12 min ago",
      schemaVersion: "v3.2",
      health: "healthy",
    },
    {
      key: "projects",
      title: "Projects",
      icon: FolderOpen,
      count: mockProjects.length,
      description: "Titles, abstracts, descriptions, keywords, status, and expertise tags.",
      sizeMb: 0.9,
      lastUpdated: "1 hr ago",
      schemaVersion: "v2.8",
      health: "healthy",
    },
    {
      key: "milestones",
      title: "Milestones",
      icon: Layers,
      count: mockMilestones.length,
      description: "Timeline milestones, due dates, completion status, and critical path markers.",
      sizeMb: 0.6,
      lastUpdated: "8 hrs ago",
      schemaVersion: "v2.8",
      health: "stale",
    },
    {
      key: "requests",
      title: "Supervision Requests",
      icon: FileSpreadsheet,
      count: mockSupervisionRequests.length,
      description: "Requests, AI match scores, match reasons, and response timeline.",
      sizeMb: 0.3,
      lastUpdated: "5 min ago",
      schemaVersion: "v1.9",
      health: "healthy",
    },
  ]

  const backups: BackupEntry[] = [
    {
      id: "bak-20241220",
      type: "automatic",
      createdAt: "Today, 03:00 UTC",
      size: "24.6 MB",
      status: "completed",
      records: totalRecords,
    },
    {
      id: "bak-20241219",
      type: "automatic",
      createdAt: "Yesterday, 03:00 UTC",
      size: "24.1 MB",
      status: "completed",
      records: totalRecords - 2,
    },
    {
      id: "bak-20241218-manual",
      type: "manual",
      createdAt: "Dec 18, 14:22 UTC",
      size: "23.9 MB",
      status: "completed",
      records: totalRecords - 5,
    },
    {
      id: "bak-20241218",
      type: "automatic",
      createdAt: "Dec 18, 03:00 UTC",
      size: "23.7 MB",
      status: "completed",
      records: totalRecords - 5,
    },
    {
      id: "bak-20241217",
      type: "automatic",
      createdAt: "Dec 17, 03:00 UTC",
      size: "23.5 MB",
      status: "completed",
      records: totalRecords - 8,
    },
  ]

  const auditLog = [
    {
      action: "Exported students dataset",
      user: currentAdmin.name,
      time: "Today, 10:42",
      type: "export",
    },
    { action: "Ran data integrity validation", user: currentAdmin.name, time: "Today, 09:15", type: "validate" },
    { action: "Manual backup triggered", user: currentAdmin.name, time: "Dec 18, 14:22", type: "backup" },
    {
      action: "Schema migration v3.2 applied",
      user: "System",
      time: "Dec 15, 02:00",
      type: "migration",
    },
    {
      action: "PII masking rules updated",
      user: currentAdmin.name,
      time: "Dec 10, 11:30",
      type: "security",
    },
  ]

  const totalSize = datasets.reduce((s, d) => s + d.sizeMb, 0)

  return (
    <DashboardShell user={currentAdmin} role="admin" title="Data Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Platform Data</h2>
            <p className="text-sm text-muted-foreground">
              Manage datasets, backups, integrity checks, and compliance controls
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <FileCheck2 className="mr-2 h-4 w-4" />
              Validate all
            </Button>
            <Button variant="outline">
              <Archive className="mr-2 h-4 w-4" />
              Manual backup
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export platform data
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Database} label="Total Records" value={totalRecords.toString()} tone="primary" />
          <StatCard
            icon={HardDrive}
            label="Storage Used"
            value={`${totalSize.toFixed(1)} MB`}
            tone="chart-2"
          />
          <StatCard icon={Layers} label="Datasets" value={datasets.length.toString()} tone="success" />
          <StatCard
            icon={Archive}
            label="Backups"
            value={backups.length.toString()}
            tone="primary"
            hint="Last 30 days"
          />
          <StatCard
            icon={CheckCircle2}
            label="Integrity"
            value="99.8%"
            tone="success"
            hint="Last check passed"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {/* Datasets */}
            <Card>
              <CardHeader>
                <CardTitle>Dataset Overview</CardTitle>
                <CardDescription>All records, schema versions, and health checks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {datasets.map((d) => {
                  const Icon = d.icon
                  return (
                    <div key={d.key} className="rounded-xl border p-4 transition hover:bg-muted/20">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{d.title}</h3>
                              <Badge variant="outline" className="font-mono text-xs">
                                {d.schemaVersion}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  d.health === "healthy"
                                    ? "border-success/30 bg-success/10 text-success"
                                    : d.health === "stale"
                                      ? "border-warning/30 bg-warning/10 text-warning"
                                      : "border-destructive/30 bg-destructive/10 text-destructive"
                                }
                              >
                                {d.health === "healthy" ? (
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                ) : (
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                )}
                                {d.health}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{d.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Database className="h-3 w-3" />
                                {d.count} records
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {d.sizeMb.toFixed(1)} MB
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated {d.lastUpdated}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 md:shrink-0">
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            Browse
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Operations */}
            <Card>
              <CardHeader>
                <CardTitle>Data Operations</CardTitle>
                <CardDescription>Import, export, migrate, validate, and clean up</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <OperationTile
                  icon={Download}
                  title="Export data"
                  description="Download datasets in CSV, JSON, or SQL for reporting and backup."
                  tone="primary"
                />
                <OperationTile
                  icon={Upload}
                  title="Import data"
                  description="Bulk upload structured files with schema validation preview."
                  tone="primary"
                />
                <OperationTile
                  icon={RefreshCw}
                  title="Refresh records"
                  description="Re-sync datasets and reload current database state."
                  tone="chart-2"
                />
                <OperationTile
                  icon={FileCheck2}
                  title="Validate integrity"
                  description="Check for missing values, broken relationships, and duplicates."
                  tone="success"
                />
                <OperationTile
                  icon={Archive}
                  title="Create backup"
                  description="Snapshot the entire platform - stored encrypted at rest."
                  tone="primary"
                />
                <OperationTile
                  icon={Lock}
                  title="Anonymize dataset"
                  description="Apply PII masking for safe sharing with researchers."
                  tone="chart-2"
                />
                <OperationTile
                  icon={FileSpreadsheet}
                  title="Generate report"
                  description="Build summary reports across users, projects, and supervision."
                  tone="primary"
                />
                <OperationTile
                  icon={History}
                  title="Schema migration"
                  description="Preview and apply database schema changes safely."
                  tone="success"
                />
                <OperationTile
                  icon={Trash2}
                  title="Purge records"
                  description="Remove or reset selected records with admin approval."
                  tone="destructive"
                />
              </CardContent>
            </Card>

            {/* Backup history */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-primary" />
                  Backup History
                </CardTitle>
                <CardDescription>Automatic and manual snapshots - retained {retentionDays} days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {backups.map((b, idx) => (
                  <div key={b.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            b.status === "completed"
                              ? "bg-success/10 text-success"
                              : b.status === "in_progress"
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {b.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {b.id}
                            <Badge
                              variant="outline"
                              className={b.type === "automatic" ? "bg-muted text-muted-foreground" : "border-primary/30 bg-primary/10 text-primary"}
                            >
                              {b.type}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {b.createdAt} - {b.records} records - {b.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                        <Button variant="ghost" size="sm">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                      </div>
                    </div>
                    {idx < backups.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Student records" value={mockStudents.length} />
                <SummaryRow label="Supervisor records" value={mockSupervisors.length} />
                <SummaryRow label="Project records" value={mockProjects.length} />
                <SummaryRow label="Milestone records" value={mockMilestones.length} />
                <SummaryRow label="Request records" value={mockSupervisionRequests.length} />
                <Separator />
                <SummaryRow label="Total records" value={totalRecords} tone="success" />
                <SummaryRow label="Storage used" value={`${totalSize.toFixed(1)} MB`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Backup Settings</CardTitle>
                <CardDescription>Automatic snapshot policy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-backup</Label>
                    <p className="text-xs text-muted-foreground">Scheduled snapshots</p>
                  </div>
                  <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Frequency</Label>
                  <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                    <SelectTrigger>
                      <Calendar className="mr-2 h-3.5 w-3.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily (03:00 UTC)</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Retention</Label>
                  <Select value={retentionDays} onValueChange={setRetentionDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="sql">SQL dump</SelectItem>
                      <SelectItem value="parquet">Parquet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">PII masking</Label>
                    <p className="text-xs text-muted-foreground">Anonymize personal data</p>
                  </div>
                  <Switch checked={piiMasking} onCheckedChange={setPiiMasking} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Recent Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditLog.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.user} - {entry.time}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-warning/30 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Caution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Always back up</span> before bulk operations - restore takes minutes,
                  lost data is forever.
                </p>
                <p className="text-muted-foreground">
                  Purge actions cannot be undone and will be recorded in the audit log with admin attribution.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Import guards */}
        <span className="hidden">
          <ShieldCheck />
          <Users />
          <Progress value={0} />
        </span>
      </div>
    </DashboardShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone: "primary" | "success" | "warning" | "destructive" | "chart-2"
  hint?: string
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
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function OperationTile({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  tone: "primary" | "success" | "destructive" | "chart-2"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    "chart-2": "bg-chart-2/10 text-chart-2",
  }
  return (
    <button
      className={`group rounded-xl border p-4 text-left transition hover:bg-muted/30 ${
        tone === "destructive" ? "border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5" : ""
      }`}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={`font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: "success" | "warning"
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground"
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  )
}
