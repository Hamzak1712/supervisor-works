"use client"

import { useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { currentSupervisor } from "@/lib/mock-data"
import {
  Bell,
  Lock,
  ShieldCheck,
  UserRound,
  SlidersHorizontal,
  Globe,
  CalendarDays,
  Save,
  Eye,
  Mail,
  MessageSquare,
  Clock3,
  Users,
  FileText,
  KeyRound,
  CheckCircle2,
} from "lucide-react"

type NotificationSettings = {
  requests: boolean
  email: boolean
  milestones: boolean
  feedback: boolean
}

export default function SupervisorSettingsPage() {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    requests: true,
    email: true,
    milestones: true,
    feedback: false,
  })

  const [form, setForm] = useState({
    name: currentSupervisor.name,
    email: currentSupervisor.email,
    department: currentSupervisor.department,
    maxStudents: currentSupervisor.maxStudents.toString(),
    bio: currentSupervisor.bio,
  })

  const [preferences, setPreferences] = useState({
    studentLevel: "both",
    supervisionMode: "hybrid",
    feedbackStyle: "balanced",
    availability: "flexible",
    notes: "",
  })

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const capacityPercent = Math.round(
    (currentSupervisor.currentStudents / currentSupervisor.maxStudents) * 100,
  )

  return (
    <DashboardShell user={currentSupervisor} role="supervisor" title="Settings">
      <div className="space-y-6">
        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            icon={<UserRound className="h-5 w-5 text-primary" />}
            label="Profile Status"
            value="Complete"
            hint="All required fields filled"
          />
          <StatusCard
            icon={<Bell className="h-5 w-5 text-primary" />}
            label="Notifications"
            value={
              Object.values(notifications).filter(Boolean).length +
              " of " +
              Object.keys(notifications).length
            }
            hint="Active channels"
          />
          <StatusCard
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
            label="Security"
            value="Protected"
            hint="Last updated recently"
          />
          <StatusCard
            icon={<SlidersHorizontal className="h-5 w-5 text-primary" />}
            label="Preferences"
            value="Custom"
            hint="Tuned to your style"
          />
        </div>

        {/* Main Settings Area */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="supervision">Supervision</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              {/* Account Tab */}
              <TabsContent value="account" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>
                      Manage your personal information and academic profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Profile photo row */}
                    <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage
                          src={currentSupervisor.avatarUrl || "/placeholder.svg"}
                          alt={currentSupervisor.name}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(currentSupervisor.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{currentSupervisor.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {currentSupervisor.email}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Change Photo
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={form.department}
                          onChange={(e) =>
                            setForm({ ...form, department: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxStudents">Maximum Capacity</Label>
                        <Input
                          id="maxStudents"
                          type="number"
                          min={0}
                          max={20}
                          value={form.maxStudents}
                          onChange={(e) =>
                            setForm({ ...form, maxStudents: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Professional Bio</Label>
                      <Textarea
                        id="bio"
                        rows={5}
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        This appears on your public profile for prospective students.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <Label className="mb-2 block">Expertise Areas</Label>
                      <div className="flex flex-wrap gap-2">
                        {currentSupervisor.expertise.map((exp) => (
                          <Badge key={exp} variant="secondary">
                            {exp}
                          </Badge>
                        ))}
                        <Button variant="outline" size="sm" className="h-7">
                          + Add Tag
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                      <Button variant="outline">Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Choose how you would like to be notified about supervision activity.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <NotificationRow
                      icon={<Bell className="h-4 w-4 text-primary" />}
                      title="Supervision request alerts"
                      description="Receive notifications when a new student sends a supervision request."
                      checked={notifications.requests}
                      onChange={(v) => setNotifications({ ...notifications, requests: v })}
                    />
                    <NotificationRow
                      icon={<Mail className="h-4 w-4 text-primary" />}
                      title="Email notifications"
                      description="Send important system updates and supervision actions to email."
                      checked={notifications.email}
                      onChange={(v) => setNotifications({ ...notifications, email: v })}
                    />
                    <NotificationRow
                      icon={<CalendarDays className="h-4 w-4 text-primary" />}
                      title="Milestone reminders"
                      description="Be reminded when student deadlines and key milestones are approaching."
                      checked={notifications.milestones}
                      onChange={(v) =>
                        setNotifications({ ...notifications, milestones: v })
                      }
                    />
                    <NotificationRow
                      icon={<MessageSquare className="h-4 w-4 text-primary" />}
                      title="Feedback activity"
                      description="Get notified when students respond or when feedback needs attention."
                      checked={notifications.feedback}
                      onChange={(v) => setNotifications({ ...notifications, feedback: v })}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Supervision Preferences Tab */}
              <TabsContent value="supervision" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Supervision Preferences</CardTitle>
                    <CardDescription>
                      Configure how you supervise and match with prospective students.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Preferred Student Level</Label>
                        <Select
                          value={preferences.studentLevel}
                          onValueChange={(v) =>
                            setPreferences({ ...preferences, studentLevel: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="undergraduate">Undergraduate</SelectItem>
                            <SelectItem value="postgraduate">Postgraduate</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Supervision Mode</Label>
                        <Select
                          value={preferences.supervisionMode}
                          onValueChange={(v) =>
                            setPreferences({ ...preferences, supervisionMode: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in-person">In Person</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Default Feedback Style</Label>
                        <Select
                          value={preferences.feedbackStyle}
                          onValueChange={(v) =>
                            setPreferences({ ...preferences, feedbackStyle: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="detailed">Detailed</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="concise">Concise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Availability Window</Label>
                        <Select
                          value={preferences.availability}
                          onValueChange={(v) =>
                            setPreferences({ ...preferences, availability: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekdays">Weekdays</SelectItem>
                            <SelectItem value="evenings">Evenings</SelectItem>
                            <SelectItem value="flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Supervision Notes</Label>
                      <Textarea
                        id="notes"
                        rows={4}
                        value={preferences.notes}
                        onChange={(e) =>
                          setPreferences({ ...preferences, notes: e.target.value })
                        }
                        placeholder="Add internal notes about your supervision style, preferred project types, or student expectations."
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button>
                        <Save className="mr-2 h-4 w-4" />
                        Save Preferences
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy &amp; Security</CardTitle>
                    <CardDescription>
                      Manage your account security and data visibility.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SecurityRow
                      icon={<KeyRound className="h-4 w-4 text-primary" />}
                      title="Password &amp; Login Security"
                      description="Update your password regularly to keep your account safe."
                      action="Change Password"
                    />
                    <SecurityRow
                      icon={<Eye className="h-4 w-4 text-primary" />}
                      title="Profile Visibility"
                      description="Control what students can view about your expertise, past projects, and availability."
                      action="Manage Visibility"
                    />
                    <SecurityRow
                      icon={<Lock className="h-4 w-4 text-primary" />}
                      title="Two-Factor Authentication"
                      description="Add an extra layer of protection to your account with 2FA."
                      action="Enable 2FA"
                    />
                    <SecurityRow
                      icon={<ShieldCheck className="h-4 w-4 text-primary" />}
                      title="Data Protection"
                      description="Review how your profile data, project records, and supervision history are handled."
                      action="Review Privacy"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Summary</CardTitle>
                <CardDescription>Your account at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SummaryRow
                  label="Current Students"
                  value={`${currentSupervisor.currentStudents}`}
                />
                <SummaryRow
                  label="Max Capacity"
                  value={`${currentSupervisor.maxStudents}`}
                />
                <SummaryRow
                  label="Capacity Used"
                  value={`${capacityPercent}%`}
                  highlight={capacityPercent >= 90}
                />
                <SummaryRow
                  label="Past Projects"
                  value={`${currentSupervisor.pastProjects.length}`}
                />
                <SummaryRow
                  label="Active Notifications"
                  value={`${Object.values(notifications).filter(Boolean).length}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Preferences</CardTitle>
                <CardDescription>Platform-wide defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SettingRow
                  icon={<Globe className="h-4 w-4 text-primary" />}
                  title="Language"
                  value="English"
                />
                <SettingRow
                  icon={<CalendarDays className="h-4 w-4 text-primary" />}
                  title="Calendar Format"
                  value="Academic"
                />
                <SettingRow
                  icon={<Clock3 className="h-4 w-4 text-primary" />}
                  title="Reminders"
                  value="Weekly"
                />
                <SettingRow
                  icon={<Users className="h-4 w-4 text-primary" />}
                  title="Student Matching"
                  value="Enabled"
                />
                <SettingRow
                  icon={<FileText className="h-4 w-4 text-primary" />}
                  title="Projects Display"
                  value="Visible"
                />
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Settings synced</p>
                  <p className="text-sm text-muted-foreground">
                    All changes are automatically saved to your profile in the final
                    version.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function StatusCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="space-y-0.5">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function SecurityRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="space-y-1">
          <p
            className="font-medium"
            dangerouslySetInnerHTML={{ __html: title }}
          />
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0">
        {action}
      </Button>
    </div>
  )
}

function SettingRow({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode
  title: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-destructive" : "font-semibold"}>
        {value}
      </span>
    </div>
  )
}
