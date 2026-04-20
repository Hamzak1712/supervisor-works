"use client"

import { useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { currentAdmin } from "@/lib/mock-data"
import {
  ShieldCheck,
  Bell,
  SlidersHorizontal,
  Lock,
  Database,
  Save,
  Users,
  Server,
  Mail,
  AlertTriangle,
  Eye,
  GraduationCap,
  Sparkles,
  Megaphone,
  Calendar,
  Key,
  Plug,
  ShieldAlert,
  CheckCircle2,
  Trash2,
} from "lucide-react"

export default function AdminSettingsPage() {
  // General
  const [platformName, setPlatformName] = useState("SupervisorMatch")
  const [platformDesc, setPlatformDesc] = useState(
    "AI-powered supervisor matching and project planning platform for students, supervisors, and administrators.",
  )
  const [supportEmail, setSupportEmail] = useState("support@university.ac.uk")
  const [language, setLanguage] = useState("en")
  const [timezone, setTimezone] = useState("Europe/London")

  // Academic
  const [currentTerm, setCurrentTerm] = useState("2024-2025 Academic Year")
  const [programMode, setProgramMode] = useState("final-year")
  const [allocationOpen, setAllocationOpen] = useState(true)
  const [registrationDeadline, setRegistrationDeadline] = useState("2025-01-15")
  const [maxProjectsPerStudent, setMaxProjectsPerStudent] = useState("1")
  const [defaultCapacity, setDefaultCapacity] = useState("5")

  // Matching algorithm
  const [matchThreshold, setMatchThreshold] = useState([70])
  const [expertiseWeight, setExpertiseWeight] = useState([45])
  const [researchWeight, setResearchWeight] = useState([30])
  const [capacityWeight, setCapacityWeight] = useState([15])
  const [pastWeight, setPastWeight] = useState([10])
  const [maxSuggestions, setMaxSuggestions] = useState("5")

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [inAppAlerts, setInAppAlerts] = useState(true)
  const [digestFrequency, setDigestFrequency] = useState("weekly")
  const [announcement, setAnnouncement] = useState("")

  // Security
  const [twoFactorRequired, setTwoFactorRequired] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState("60")
  const [passwordMinLength, setPasswordMinLength] = useState("12")
  const [ipAllowList, setIpAllowList] = useState("")
  const [auditLogging, setAuditLogging] = useState(true)

  // Integrations
  const [smtpProvider, setSmtpProvider] = useState("sendgrid")
  const [aiProvider, setAiProvider] = useState("openai")

  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const totalWeight = expertiseWeight[0] + researchWeight[0] + capacityWeight[0] + pastWeight[0]

  return (
    <DashboardShell user={currentAdmin} role="admin" title="Platform Settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Platform Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Institution-wide controls for behaviour, notifications, security, and integrations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Discard changes</Button>
            <Button onClick={handleSave} disabled={saved}>
              {saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save all settings
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={SlidersHorizontal} label="Platform" value="Configured" tone="primary" />
          <StatCard icon={ShieldCheck} label="Security" value="Enabled" tone="success" />
          <StatCard
            icon={Bell}
            label="Alerts"
            value={emailAlerts || inAppAlerts ? "Active" : "Off"}
            tone={emailAlerts || inAppAlerts ? "success" : "warning"}
          />
          <StatCard
            icon={Sparkles}
            label="Matching"
            value={allocationOpen ? "Open" : "Closed"}
            tone={allocationOpen ? "success" : "warning"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="academic">Academic</TabsTrigger>
                <TabsTrigger value="matching">Matching AI</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
              </TabsList>

              {/* General */}
              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform Identity</CardTitle>
                    <CardDescription>Names, branding, and regional defaults</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="platform-name">Platform name</Label>
                        <Input
                          id="platform-name"
                          value={platformName}
                          onChange={(e) => setPlatformName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="support-email">Support email</Label>
                        <Input
                          id="support-email"
                          type="email"
                          value={supportEmail}
                          onChange={(e) => setSupportEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default language</Label>
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Espanol (planned)</SelectItem>
                            <SelectItem value="fr">Francais (planned)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                            <SelectItem value="Europe/Dublin">Europe/Dublin</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platform-desc">Platform description</Label>
                      <Textarea
                        id="platform-desc"
                        value={platformDesc}
                        onChange={(e) => setPlatformDesc(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Controls</CardTitle>
                    <CardDescription>Global operational toggles</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { icon: Bell, title: "System alerts", desc: "Admin notifications for degraded services and security events." },
                      { icon: Users, title: "User approval control", desc: "Require admin approval for high-level role changes." },
                      { icon: Server, title: "System monitoring", desc: "Continuous health and uptime monitoring." },
                      { icon: Mail, title: "Email summaries", desc: "Scheduled digest reports to admins." },
                    ].map((row, idx, arr) => (
                      <div key={row.title}>
                        <div className="flex items-center justify-between gap-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <row.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{row.title}</p>
                              <p className="text-sm text-muted-foreground">{row.desc}</p>
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        {idx < arr.length - 1 && <Separator />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Academic */}
              <TabsContent value="academic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Academic Period</CardTitle>
                    <CardDescription>Term setup, mode, and deadlines</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="term">Current term</Label>
                        <Input id="term" value={currentTerm} onChange={(e) => setCurrentTerm(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Program mode</Label>
                        <Select value={programMode} onValueChange={setProgramMode}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="final-year">Final Year Project</SelectItem>
                            <SelectItem value="research">Research Project</SelectItem>
                            <SelectItem value="general">General Supervision</SelectItem>
                            <SelectItem value="phd">PhD Program</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deadline">Registration deadline</Label>
                        <Input
                          id="deadline"
                          type="date"
                          value={registrationDeadline}
                          onChange={(e) => setRegistrationDeadline(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default supervisor capacity</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={defaultCapacity}
                          onChange={(e) => setDefaultCapacity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max projects per student</Label>
                        <Select value={maxProjectsPerStudent} onValueChange={setMaxProjectsPerStudent}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 project</SelectItem>
                            <SelectItem value="2">2 projects</SelectItem>
                            <SelectItem value="3">3 projects</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Allocation window open</p>
                          <p className="text-sm text-muted-foreground">
                            When enabled, students can submit supervision requests
                          </p>
                        </div>
                      </div>
                      <Switch checked={allocationOpen} onCheckedChange={setAllocationOpen} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Milestone Policies</CardTitle>
                    <CardDescription>Deadline enforcement across all projects</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { title: "Block edits after critical deadlines", desc: "PPRS, IPD, and Final Viva cannot be rescheduled.", defaultOn: true },
                      { title: "Auto-notify late milestones", desc: "Alert supervisor 3 days before due date.", defaultOn: true },
                      { title: "Require supervisor sign-off", desc: "Milestone completion needs supervisor approval.", defaultOn: true },
                      { title: "Lock project after submission", desc: "Final reports become read-only post-viva.", defaultOn: true },
                    ].map((row, idx, arr) => (
                      <div key={row.title}>
                        <div className="flex items-center justify-between gap-4 py-3">
                          <div>
                            <p className="font-medium">{row.title}</p>
                            <p className="text-sm text-muted-foreground">{row.desc}</p>
                          </div>
                          <Switch defaultChecked={row.defaultOn} />
                        </div>
                        {idx < arr.length - 1 && <Separator />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Matching algorithm */}
              <TabsContent value="matching" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      AI Matching Configuration
                    </CardTitle>
                    <CardDescription>Tune the matching algorithm that powers supervisor recommendations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Match score threshold</Label>
                          <span className="text-sm font-semibold tabular-nums">{matchThreshold[0]}%</span>
                        </div>
                        <Slider value={matchThreshold} onValueChange={setMatchThreshold} min={30} max={95} step={5} />
                        <p className="text-xs text-muted-foreground">
                          Suggestions below this score are hidden from students.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Max suggestions shown</Label>
                        <Select value={maxSuggestions} onValueChange={setMaxSuggestions}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">Top 3</SelectItem>
                            <SelectItem value="5">Top 5</SelectItem>
                            <SelectItem value="10">Top 10</SelectItem>
                            <SelectItem value="20">Top 20</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Scoring weights</h4>
                          <p className="text-sm text-muted-foreground">
                            Total must equal 100%. Currently:{" "}
                            <span
                              className={totalWeight === 100 ? "text-success font-semibold" : "text-warning font-semibold"}
                            >
                              {totalWeight}%
                            </span>
                          </p>
                        </div>
                        {totalWeight !== 100 && (
                          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Adjust weights
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-5">
                        <WeightSlider
                          label="Expertise overlap"
                          description="How many expertise tags match student project keywords"
                          value={expertiseWeight}
                          onChange={setExpertiseWeight}
                        />
                        <WeightSlider
                          label="Research area alignment"
                          description="Overlap between supervisor research areas and student interests"
                          value={researchWeight}
                          onChange={setResearchWeight}
                        />
                        <WeightSlider
                          label="Available capacity"
                          description="Bonus for supervisors with more remaining slots"
                          value={capacityWeight}
                          onChange={setCapacityWeight}
                        />
                        <WeightSlider
                          label="Past project similarity"
                          description="Similarity to supervisor's completed projects"
                          value={pastWeight}
                          onChange={setPastWeight}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-xl border bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">Re-run matching for all students</p>
                          <p className="text-sm text-muted-foreground">
                            Apply current weights to regenerate suggestions. Existing requests are preserved.
                          </p>
                        </div>
                        <Button size="sm" disabled={totalWeight !== 100}>
                          Run now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Channels</CardTitle>
                    <CardDescription>Where and how often updates are delivered</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Email alerts</p>
                          <p className="text-sm text-muted-foreground">Send transactional emails to users</p>
                        </div>
                      </div>
                      <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">In-app notifications</p>
                          <p className="text-sm text-muted-foreground">Toast alerts in the product</p>
                        </div>
                      </div>
                      <Switch checked={inAppAlerts} onCheckedChange={setInAppAlerts} />
                    </div>
                    <div className="space-y-2">
                      <Label>Digest frequency</Label>
                      <Select value={digestFrequency} onValueChange={setDigestFrequency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">No digest</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-primary" />
                      Platform Announcement
                    </CardTitle>
                    <CardDescription>Publish a banner to all users</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      rows={3}
                      placeholder="e.g. Scheduled maintenance on Sunday between 02:00-04:00 UTC..."
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {announcement.length} characters - visible on every dashboard page
                      </p>
                      <Button disabled={!announcement.trim()}>
                        <Megaphone className="mr-2 h-4 w-4" />
                        Publish
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>Customize transactional emails</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      "Welcome email (new user)",
                      "Password reset",
                      "Supervision request received",
                      "Match suggestion digest",
                      "Milestone deadline reminder",
                      "Account suspended notification",
                    ].map((t) => (
                      <div
                        key={t}
                        className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{t}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Authentication & Access</CardTitle>
                    <CardDescription>Protect accounts and restrict sensitive actions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Key className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Require 2FA for admins</p>
                          <p className="text-sm text-muted-foreground">
                            Admins must enroll a second factor to sign in
                          </p>
                        </div>
                      </div>
                      <Switch checked={twoFactorRequired} onCheckedChange={setTwoFactorRequired} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Session timeout (minutes)</Label>
                        <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="240">4 hours</SelectItem>
                            <SelectItem value="480">8 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Minimum password length</Label>
                        <Input
                          type="number"
                          min="8"
                          max="64"
                          value={passwordMinLength}
                          onChange={(e) => setPasswordMinLength(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ip-allow">IP allowlist (optional)</Label>
                      <Textarea
                        id="ip-allow"
                        rows={2}
                        placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24 - one per line"
                        value={ipAllowList}
                        onChange={(e) => setIpAllowList(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Admin sign-ins only accepted from these ranges. Leave empty to disable.
                      </p>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Audit logging</p>
                        <p className="text-sm text-muted-foreground">
                          Record every admin action with user, timestamp, and IP
                        </p>
                      </div>
                      <Switch checked={auditLogging} onCheckedChange={setAuditLogging} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Role Permissions</CardTitle>
                    <CardDescription>What each role can access and modify</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <PermissionRow icon={GraduationCap} role="Student" scopes={["Read projects", "Submit requests"]} />
                    <Separator />
                    <PermissionRow
                      icon={Users}
                      role="Supervisor"
                      scopes={["Manage students", "Approve requests", "Update capacity"]}
                    />
                    <Separator />
                    <PermissionRow
                      icon={ShieldCheck}
                      role="Admin"
                      scopes={["All data", "All users", "System config", "Audit log"]}
                    />
                  </CardContent>
                </Card>

                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <ShieldAlert className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>Irreversible and destructive actions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-background p-4">
                      <div>
                        <p className="font-medium">Invalidate all sessions</p>
                        <p className="text-sm text-muted-foreground">
                          Force every user to sign in again immediately
                        </p>
                      </div>
                      <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 bg-transparent">
                        Sign everyone out
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-background p-4">
                      <div>
                        <p className="font-medium">Reset platform data</p>
                        <p className="text-sm text-muted-foreground">Erases users, projects, and milestones</p>
                      </div>
                      <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 bg-transparent">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Reset platform
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations */}
              <TabsContent value="integrations" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Service Integrations</CardTitle>
                    <CardDescription>Connect external providers for delivery and AI</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <IntegrationRow
                      title="Email (SMTP)"
                      description="Transactional email delivery"
                      status="connected"
                    >
                      <Select value={smtpProvider} onValueChange={setSmtpProvider}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sendgrid">SendGrid</SelectItem>
                          <SelectItem value="mailgun">Mailgun</SelectItem>
                          <SelectItem value="ses">AWS SES</SelectItem>
                          <SelectItem value="postmark">Postmark</SelectItem>
                        </SelectContent>
                      </Select>
                    </IntegrationRow>
                    <IntegrationRow
                      title="AI Matching Engine"
                      description="LLM provider for semantic similarity"
                      status="connected"
                    >
                      <Select value={aiProvider} onValueChange={setAiProvider}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="vertex">Google Vertex</SelectItem>
                          <SelectItem value="self-hosted">Self-hosted</SelectItem>
                        </SelectContent>
                      </Select>
                    </IntegrationRow>
                    <IntegrationRow title="SSO (SAML/OIDC)" description="University identity provider" status="pending">
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </IntegrationRow>
                    <IntegrationRow
                      title="LMS Sync (Moodle/Canvas)"
                      description="Sync courses and enrolments"
                      status="disconnected"
                    >
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    </IntegrationRow>
                    <IntegrationRow
                      title="Webhooks"
                      description="Push events to external systems"
                      status="disconnected"
                    >
                      <Button variant="outline" size="sm">
                        Add endpoint
                      </Button>
                    </IntegrationRow>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      API Access
                    </CardTitle>
                    <CardDescription>Issue and manage API keys for external systems</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "Reporting service", masked: "sk_live_***_reporting", created: "Dec 01, 2024" },
                      { name: "Analytics pipeline", masked: "sk_live_***_analytics", created: "Nov 15, 2024" },
                    ].map((k) => (
                      <div key={k.name} className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-medium">{k.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {k.masked} - issued {k.created}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            Rotate
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full bg-transparent">
                      <Key className="mr-2 h-4 w-4" />
                      Generate new API key
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Admin" value={currentAdmin.name} />
                <SummaryRow label="Permissions" value={currentAdmin.permissions.length} />
                <Separator />
                <SummaryRow
                  label="Allocation"
                  value={allocationOpen ? "Open" : "Closed"}
                  tone={allocationOpen ? "success" : "warning"}
                />
                <SummaryRow
                  label="Matching threshold"
                  value={`${matchThreshold[0]}%`}
                />
                <SummaryRow label="Weight total" value={`${totalWeight}%`} tone={totalWeight === 100 ? "success" : "warning"} />
                <SummaryRow label="2FA required" value={twoFactorRequired ? "Yes" : "No"} tone={twoFactorRequired ? "success" : "warning"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preference Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SettingChip icon={Eye} label="Visibility" value="Role-based" />
                <SettingChip icon={Lock} label="Access" value="Protected" />
                <SettingChip icon={Database} label="Backups" value="Configured" />
                <SettingChip icon={Plug} label="Integrations" value="3 active" />
              </CardContent>
            </Card>

            <Card className="border-warning/30 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Admin Changes Affect Everyone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Settings here apply platform-wide. Double-check before saving and always test non-production-safe
                  integrations in a sandbox first.
                </p>
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
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number[]
  onChange: (v: number[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums">{value[0]}%</span>
      </div>
      <Slider value={value} onValueChange={onChange} min={0} max={100} step={5} />
    </div>
  )
}

function PermissionRow({
  icon: Icon,
  role,
  scopes,
}: {
  icon: React.ComponentType<{ className?: string }>
  role: string
  scopes: string[]
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">{role}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {scopes.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm">
        Configure
      </Button>
    </div>
  )
}

function IntegrationRow({
  title,
  description,
  status,
  children,
}: {
  title: string
  description: string
  status: "connected" | "pending" | "disconnected"
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Plug className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{title}</p>
            <Badge
              variant="outline"
              className={
                status === "connected"
                  ? "border-success/30 bg-success/10 text-success"
                  : status === "pending"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
              }
            >
              {status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function SettingChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground">{value}</span>
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
