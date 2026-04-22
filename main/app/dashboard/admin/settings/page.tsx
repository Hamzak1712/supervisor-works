"use client"

import { useEffect, useState } from "react"
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

type AcademicPeriod = {
  id: string
  name: string
  startDate: string
  endDate: string
  projectEndPolicyAt: string | null
  requestSupervisorCutoffAt: string | null
  proposalSubmissionCutoffAt: string | null
  finalSubmissionAt: string | null
  isActive: boolean
  isArchived: boolean
}

type AcademicPayload = {
  periods: AcademicPeriod[]
  activePeriodId: string | null
}

type AcademicPeriodForm = {
  name: string
  startDate: string
  endDate: string
  projectEndPolicyAt: string
  requestSupervisorCutoffAt: string
  proposalSubmissionCutoffAt: string
  finalSubmissionAt: string
}

type PlatformSettingsPayload = {
  settings: {
    institutionName: string
    institutionLogoUrl: string | null
    institutionFaviconUrl: string | null
    platformDescription: string | null
    supportEmail: string | null
    defaultLocale: string
    defaultTimezone: string
    themeMode: string
    featureMessagingEnabled: boolean
    featureMeetingsEnabled: boolean
    featureAnnouncementsEnabled: boolean
    featureAiExplanationsEnabled: boolean
    smtpProvider: string
    smtpHost: string | null
    smtpPort: number | null
    smtpUser: string | null
    smtpApiKeyMasked: string | null
    aiProvider: string
    aiModel: string | null
    aiTemperature: number
    aiRateLimitPerMin: number
    aiApiKeyMasked: string | null
    ssoProvider: string | null
    ssoEnabled: boolean
    lmsProvider: string | null
    lmsEnabled: boolean
    calendarProvider: string | null
    calendarEnabled: boolean
    sessionTimeoutMinutes: number
    passwordMinLength: number
    twoFactorRequiredForAdmin: boolean
    ipAllowList: string | null
    auditLoggingEnabled: boolean
  }
  apiKeys: Array<{
    id: string
    name: string
    service: string
    keyPrefix: string
    lastUsedAt: string | null
    revokedAt: string | null
    createdAt: string
  }>
  createdSecret?: string
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ""
  return value.slice(0, 10)
}

function periodToForm(period: AcademicPeriod): AcademicPeriodForm {
  return {
    name: period.name || "",
    startDate: toDateInput(period.startDate),
    endDate: toDateInput(period.endDate),
    projectEndPolicyAt: toDateInput(period.projectEndPolicyAt),
    requestSupervisorCutoffAt: toDateInput(period.requestSupervisorCutoffAt),
    proposalSubmissionCutoffAt: toDateInput(period.proposalSubmissionCutoffAt),
    finalSubmissionAt: toDateInput(period.finalSubmissionAt),
  }
}

const blankAcademicForm: AcademicPeriodForm = {
  name: "",
  startDate: "",
  endDate: "",
  projectEndPolicyAt: "",
  requestSupervisorCutoffAt: "",
  proposalSubmissionCutoffAt: "",
  finalSubmissionAt: "",
}

export default function AdminSettingsPage() {
  // General
  const [platformName, setPlatformName] = useState("SupervisorMatch")
  const [platformDesc, setPlatformDesc] = useState(
    "AI-powered supervisor matching and project planning platform for students, supervisors, and administrators.",
  )
  const [supportEmail, setSupportEmail] = useState("support@university.ac.uk")
  const [language, setLanguage] = useState("en")
  const [timezone, setTimezone] = useState("Europe/London")
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState("")
  const [institutionFaviconUrl, setInstitutionFaviconUrl] = useState("")
  const [themeMode, setThemeMode] = useState("dark")
  const [featureMessagingEnabled, setFeatureMessagingEnabled] = useState(true)
  const [featureMeetingsEnabled, setFeatureMeetingsEnabled] = useState(true)
  const [featureAnnouncementsEnabled, setFeatureAnnouncementsEnabled] = useState(true)
  const [featureAiExplanationsEnabled, setFeatureAiExplanationsEnabled] = useState(true)

  // Academic
  const [currentTerm, setCurrentTerm] = useState("2024-2025 Academic Year")
  const [programMode, setProgramMode] = useState("final-year")
  const [allocationOpen, setAllocationOpen] = useState(true)
  const [registrationDeadline, setRegistrationDeadline] = useState("2025-01-15")
  const [maxProjectsPerStudent, setMaxProjectsPerStudent] = useState("1")
  const [defaultCapacity, setDefaultCapacity] = useState("5")
  const [academicLoading, setAcademicLoading] = useState(true)
  const [academicBusy, setAcademicBusy] = useState(false)
  const [academicError, setAcademicError] = useState("")
  const [academicNotice, setAcademicNotice] = useState("")
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>([])
  const [activeAcademicPeriodId, setActiveAcademicPeriodId] = useState<string | null>(null)
  const [selectedAcademicPeriodId, setSelectedAcademicPeriodId] = useState("")
  const [selectedAcademicForm, setSelectedAcademicForm] = useState<AcademicPeriodForm | null>(null)
  const [newAcademicForm, setNewAcademicForm] = useState<AcademicPeriodForm>(blankAcademicForm)

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
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpApiKey, setSmtpApiKey] = useState("")
  const [smtpApiKeyMasked, setSmtpApiKeyMasked] = useState("")
  const [aiModel, setAiModel] = useState("gpt-5.2")
  const [aiTemperature, setAiTemperature] = useState("0.2")
  const [aiRateLimitPerMin, setAiRateLimitPerMin] = useState("60")
  const [aiApiKey, setAiApiKey] = useState("")
  const [aiApiKeyMasked, setAiApiKeyMasked] = useState("")
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [lmsEnabled, setLmsEnabled] = useState(false)
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [apiKeys, setApiKeys] = useState<PlatformSettingsPayload["apiKeys"]>([])
  const [newApiKeyService, setNewApiKeyService] = useState("internal")
  const [newApiKeyName, setNewApiKeyName] = useState("")
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] = useState("")

  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsError, setSettingsError] = useState("")
  const [settingsNotice, setSettingsNotice] = useState("")

  const [saved, setSaved] = useState(false)

  const activeAcademicPeriod =
    academicPeriods.find((period) => period.id === activeAcademicPeriodId) || null

  async function fetchAcademicPeriods() {
    try {
      setAcademicLoading(true)
      setAcademicError("")

      const token = localStorage.getItem("token")
      const res = await fetch("/api/admin/academic-periods", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = (await res.json()) as AcademicPayload | { error?: string }

      if (!res.ok || !("periods" in data)) {
        throw new Error((data as { error?: string })?.error || "Failed to load academic periods")
      }

      setAcademicPeriods(data.periods)
      setActiveAcademicPeriodId(data.activePeriodId)

      const nextSelectedId =
        (selectedAcademicPeriodId &&
          data.periods.some((period) => period.id === selectedAcademicPeriodId) &&
          selectedAcademicPeriodId) ||
        data.activePeriodId ||
        data.periods[0]?.id ||
        ""

      setSelectedAcademicPeriodId(nextSelectedId)

      const selected = data.periods.find((period) => period.id === nextSelectedId) || null
      setSelectedAcademicForm(selected ? periodToForm(selected) : null)
    } catch (err: any) {
      console.error(err)
      setAcademicError(err?.message || "Could not load academic period settings.")
    } finally {
      setAcademicLoading(false)
    }
  }

  async function fetchPlatformSettings() {
    try {
      setSettingsError("")
      const token = localStorage.getItem("token")
      const res = await fetch("/api/admin/settings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = (await res.json()) as PlatformSettingsPayload | { error?: string }

      if (!res.ok || !("settings" in data)) {
        throw new Error((data as { error?: string })?.error || "Failed to load platform settings")
      }

      const settings = data.settings
      setPlatformName(settings.institutionName)
      setPlatformDesc(settings.platformDescription || "")
      setSupportEmail(settings.supportEmail || "")
      setLanguage(settings.defaultLocale || "en")
      setTimezone(settings.defaultTimezone || "Europe/London")
      setInstitutionLogoUrl(settings.institutionLogoUrl || "")
      setInstitutionFaviconUrl(settings.institutionFaviconUrl || "")
      setThemeMode(settings.themeMode || "dark")
      setFeatureMessagingEnabled(settings.featureMessagingEnabled)
      setFeatureMeetingsEnabled(settings.featureMeetingsEnabled)
      setFeatureAnnouncementsEnabled(settings.featureAnnouncementsEnabled)
      setFeatureAiExplanationsEnabled(settings.featureAiExplanationsEnabled)
      setSmtpProvider(settings.smtpProvider || "sendgrid")
      setAiProvider(settings.aiProvider || "openai")
      setSmtpHost(settings.smtpHost || "")
      setSmtpPort(settings.smtpPort ? `${settings.smtpPort}` : "587")
      setSmtpUser(settings.smtpUser || "")
      setSmtpApiKeyMasked(settings.smtpApiKeyMasked || "")
      setAiModel(settings.aiModel || "gpt-5.2")
      setAiTemperature(`${settings.aiTemperature}`)
      setAiRateLimitPerMin(`${settings.aiRateLimitPerMin}`)
      setAiApiKeyMasked(settings.aiApiKeyMasked || "")
      setSsoEnabled(settings.ssoEnabled)
      setLmsEnabled(settings.lmsEnabled)
      setCalendarEnabled(settings.calendarEnabled)
      setSessionTimeout(`${settings.sessionTimeoutMinutes}`)
      setPasswordMinLength(`${settings.passwordMinLength}`)
      setTwoFactorRequired(settings.twoFactorRequiredForAdmin)
      setIpAllowList(settings.ipAllowList || "")
      setAuditLogging(settings.auditLoggingEnabled)
      setApiKeys(data.apiKeys || [])
    } catch (err: any) {
      console.error(err)
      setSettingsError(err?.message || "Could not load platform settings.")
    }
  }

  async function runSettingsAction(body: Record<string, unknown>, notice: string) {
    try {
      setSettingsBusy(true)
      setSettingsError("")
      const token = localStorage.getItem("token")
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as PlatformSettingsPayload | { error?: string }
      if (!res.ok || !("settings" in data)) {
        throw new Error((data as { error?: string })?.error || "Settings action failed")
      }
      setApiKeys(data.apiKeys || [])
      if ("createdSecret" in data && typeof data.createdSecret === "string") {
        setNewlyGeneratedSecret(data.createdSecret)
      }
      setSmtpApiKey("")
      setAiApiKey("")
      setSettingsNotice(notice)
      window.setTimeout(() => setSettingsNotice(""), 2800)
      await fetchPlatformSettings()
    } catch (err: any) {
      console.error(err)
      setSettingsError(err?.message || "Settings action failed.")
    } finally {
      setSettingsBusy(false)
    }
  }

  async function runAcademicAction(
    request: {
      method: "POST" | "PUT"
      body: Record<string, unknown>
    },
    successNotice: string
  ) {
    try {
      setAcademicBusy(true)
      setAcademicError("")

      const token = localStorage.getItem("token")
      const res = await fetch("/api/admin/academic-periods", {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request.body),
      })

      const data = (await res.json()) as AcademicPayload | { error?: string }

      if (!res.ok || !("periods" in data)) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      setAcademicPeriods(data.periods)
      setActiveAcademicPeriodId(data.activePeriodId)

      const selectedId =
        (selectedAcademicPeriodId &&
          data.periods.some((period) => period.id === selectedAcademicPeriodId) &&
          selectedAcademicPeriodId) ||
        data.activePeriodId ||
        data.periods[0]?.id ||
        ""

      setSelectedAcademicPeriodId(selectedId)
      const selected = data.periods.find((period) => period.id === selectedId) || null
      setSelectedAcademicForm(selected ? periodToForm(selected) : null)

      setAcademicNotice(successNotice)
      window.setTimeout(() => setAcademicNotice(""), 2400)
    } catch (err: any) {
      console.error(err)
      setAcademicError(err?.message || "Academic period action failed.")
    } finally {
      setAcademicBusy(false)
    }
  }

  useEffect(() => {
    void fetchAcademicPeriods()
    void fetchPlatformSettings()
  }, [])

  useEffect(() => {
    if (!selectedAcademicPeriodId) {
      setSelectedAcademicForm(null)
      return
    }

    const selected = academicPeriods.find(
      (period) => period.id === selectedAcademicPeriodId
    )
    setSelectedAcademicForm(selected ? periodToForm(selected) : null)
  }, [academicPeriods, selectedAcademicPeriodId])

  async function handleSave() {
    await runSettingsAction(
      {
        action: "save_settings",
        institutionName: platformName,
        institutionLogoUrl,
        institutionFaviconUrl,
        platformDescription: platformDesc,
        supportEmail,
        defaultLocale: language,
        defaultTimezone: timezone,
        themeMode,
        featureMessagingEnabled,
        featureMeetingsEnabled,
        featureAnnouncementsEnabled,
        featureAiExplanationsEnabled,
        smtpProvider,
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpApiKey,
        aiProvider,
        aiModel,
        aiTemperature: Number(aiTemperature),
        aiRateLimitPerMin: Number(aiRateLimitPerMin),
        aiApiKey,
        ssoEnabled,
        lmsEnabled,
        calendarEnabled,
        sessionTimeoutMinutes: Number(sessionTimeout),
        passwordMinLength: Number(passwordMinLength),
        twoFactorRequiredForAdmin: twoFactorRequired,
        ipAllowList: ipAllowList,
        auditLoggingEnabled: auditLogging,
      },
      "Platform settings saved."
    )
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
            <Button onClick={() => void handleSave()} disabled={saved || settingsBusy}>
              {saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {settingsBusy ? "Saving..." : "Save all settings"}
                </>
              )}
            </Button>
          </div>
        </div>
        {settingsError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {settingsError}
          </div>
        )}
        {settingsNotice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            {settingsNotice}
          </div>
        )}

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
                      <div className="space-y-2">
                        <Label>Theme mode</Label>
                        <Select value={themeMode} onValueChange={setThemeMode}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="institution-logo">Institution logo URL</Label>
                        <Input
                          id="institution-logo"
                          value={institutionLogoUrl}
                          onChange={(e) => setInstitutionLogoUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="institution-favicon">Favicon URL</Label>
                        <Input
                          id="institution-favicon"
                          value={institutionFaviconUrl}
                          onChange={(e) => setInstitutionFaviconUrl(e.target.value)}
                          placeholder="https://..."
                        />
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
                      {
                        icon: Bell,
                        title: "Messaging module",
                        desc: "Enable or disable in-app messaging globally.",
                        checked: featureMessagingEnabled,
                        onToggle: setFeatureMessagingEnabled,
                      },
                      {
                        icon: Calendar,
                        title: "Meetings module",
                        desc: "Enable or disable meetings and scheduling flows.",
                        checked: featureMeetingsEnabled,
                        onToggle: setFeatureMeetingsEnabled,
                      },
                      {
                        icon: Megaphone,
                        title: "Announcements module",
                        desc: "Enable or disable announcement publishing and banners.",
                        checked: featureAnnouncementsEnabled,
                        onToggle: setFeatureAnnouncementsEnabled,
                      },
                      {
                        icon: Sparkles,
                        title: "AI explanations",
                        desc: "Show or hide AI-generated matching explanations.",
                        checked: featureAiExplanationsEnabled,
                        onToggle: setFeatureAiExplanationsEnabled,
                      },
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
                          <Switch checked={row.checked} onCheckedChange={row.onToggle} />
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
                    <CardTitle>Academic Period Management</CardTitle>
                    <CardDescription>
                      Create, edit, archive periods and control active cut-off policy dates.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {academicError && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        {academicError}
                      </div>
                    )}
                    {academicNotice && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
                        {academicNotice}
                      </div>
                    )}

                    {academicLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading academic periods...
                      </p>
                    ) : (
                      <>
                        <div className="rounded-xl border bg-primary/5 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Active period
                          </p>
                          <p className="mt-1 text-base font-semibold">
                            {activeAcademicPeriod?.name || "No active period"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeAcademicPeriod
                              ? `${toDateInput(activeAcademicPeriod.startDate)} to ${toDateInput(activeAcademicPeriod.endDate)}`
                              : "Set an active period to bind new projects and requests."}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Select period to edit</Label>
                            <Select
                              value={selectedAcademicPeriodId}
                              onValueChange={setSelectedAcademicPeriodId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose period" />
                              </SelectTrigger>
                              <SelectContent>
                                {academicPeriods.map((period) => (
                                  <SelectItem key={period.id} value={period.id}>
                                    {period.name}
                                    {period.isActive ? " (Active)" : ""}
                                    {period.isArchived ? " (Archived)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {selectedAcademicForm && (
                          <div className="space-y-4 rounded-xl border p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Period name</Label>
                                <Input
                                  value={selectedAcademicForm.name}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev ? { ...prev, name: e.target.value } : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Start date</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.startDate}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev ? { ...prev, startDate: e.target.value } : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>End date</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.endDate}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev ? { ...prev, endDate: e.target.value } : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Project end-date policy</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.projectEndPolicyAt}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev
                                        ? { ...prev, projectEndPolicyAt: e.target.value }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Request supervisor cut-off</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.requestSupervisorCutoffAt}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            requestSupervisorCutoffAt: e.target.value,
                                          }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Proposal submission cut-off</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.proposalSubmissionCutoffAt}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            proposalSubmissionCutoffAt: e.target.value,
                                          }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Final submission date</Label>
                                <Input
                                  type="date"
                                  value={selectedAcademicForm.finalSubmissionAt}
                                  onChange={(e) =>
                                    setSelectedAcademicForm((prev) =>
                                      prev
                                        ? { ...prev, finalSubmissionAt: e.target.value }
                                        : prev
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                disabled={academicBusy || !selectedAcademicPeriodId}
                                onClick={() =>
                                  void runAcademicAction(
                                    {
                                      method: "PUT",
                                      body: {
                                        action: "update_period",
                                        periodId: selectedAcademicPeriodId,
                                        ...selectedAcademicForm,
                                      },
                                    },
                                    "Academic period updated."
                                  )
                                }
                              >
                                Save Period
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={academicBusy || !selectedAcademicPeriodId}
                                onClick={() =>
                                  void runAcademicAction(
                                    {
                                      method: "PUT",
                                      body: {
                                        action: "set_active_period",
                                        periodId: selectedAcademicPeriodId,
                                      },
                                    },
                                    "Active academic period updated."
                                  )
                                }
                              >
                                Set Active
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={academicBusy || !selectedAcademicPeriodId}
                                onClick={() =>
                                  void runAcademicAction(
                                    {
                                      method: "PUT",
                                      body: {
                                        action: "archive_period",
                                        periodId: selectedAcademicPeriodId,
                                      },
                                    },
                                    "Academic period archived."
                                  )
                                }
                              >
                                Archive Period
                              </Button>
                            </div>
                          </div>
                        )}

                        <Separator />

                        <div className="space-y-4 rounded-xl border p-4">
                          <p className="font-medium">Create New Academic Period</p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Period name</Label>
                              <Input
                                placeholder="e.g. 2026/27"
                                value={newAcademicForm.name}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Start date</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.startDate}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    startDate: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>End date</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.endDate}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    endDate: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Project end-date policy</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.projectEndPolicyAt}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    projectEndPolicyAt: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Request supervisor cut-off</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.requestSupervisorCutoffAt}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    requestSupervisorCutoffAt: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Proposal submission cut-off</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.proposalSubmissionCutoffAt}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    proposalSubmissionCutoffAt: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Final submission date</Label>
                              <Input
                                type="date"
                                value={newAcademicForm.finalSubmissionAt}
                                onChange={(e) =>
                                  setNewAcademicForm((prev) => ({
                                    ...prev,
                                    finalSubmissionAt: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={academicBusy}
                            onClick={() =>
                              void runAcademicAction(
                                {
                                  method: "POST",
                                  body: newAcademicForm,
                                },
                                "Academic period created."
                              ).then(() => {
                                setNewAcademicForm(blankAcademicForm)
                              })
                            }
                          >
                            Create Period
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Legacy Academic Controls</CardTitle>
                    <CardDescription>Existing academic settings still available</CardDescription>
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
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SMTP host</Label>
                        <Input
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.example.edu"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP port</Label>
                        <Input
                          type="number"
                          min="1"
                          max="65535"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP user</Label>
                        <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP API key</Label>
                        <Input
                          value={smtpApiKey}
                          onChange={(e) => setSmtpApiKey(e.target.value)}
                          placeholder={smtpApiKeyMasked || "Set new key"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>AI model</Label>
                        <Input value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>AI temperature</Label>
                        <Input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={aiTemperature}
                          onChange={(e) => setAiTemperature(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>AI rate limit (rpm)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={aiRateLimitPerMin}
                          onChange={(e) => setAiRateLimitPerMin(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>AI API key</Label>
                        <Input
                          value={aiApiKey}
                          onChange={(e) => setAiApiKey(e.target.value)}
                          placeholder={aiApiKeyMasked || "Set new key"}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">SSO enabled</p>
                          <p className="text-xs text-muted-foreground">SAML/OAuth provider</p>
                        </div>
                        <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">LMS sync</p>
                          <p className="text-xs text-muted-foreground">Auto-sync student lists</p>
                        </div>
                        <Switch checked={lmsEnabled} onCheckedChange={setLmsEnabled} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Calendar sync</p>
                          <p className="text-xs text-muted-foreground">Google/Outlook sync</p>
                        </div>
                        <Switch checked={calendarEnabled} onCheckedChange={setCalendarEnabled} />
                      </div>
                    </div>
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
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-medium">
                            {k.name} <span className="text-xs text-muted-foreground">({k.service})</span>
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {k.keyPrefix}*** - issued {new Date(k.createdAt).toLocaleDateString()}
                            {k.lastUsedAt ? ` - last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                            {k.revokedAt ? " - revoked" : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={settingsBusy}
                            onClick={() =>
                              void runSettingsAction(
                                { action: "rotate_api_key", keyId: k.id },
                                "API key rotated."
                              )
                            }
                          >
                            Rotate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={settingsBusy || Boolean(k.revokedAt)}
                            onClick={() =>
                              void runSettingsAction(
                                { action: "revoke_api_key", keyId: k.id },
                                "API key revoked."
                              )
                            }
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        value={newApiKeyService}
                        onChange={(e) => setNewApiKeyService(e.target.value)}
                        placeholder="Service"
                      />
                      <Input
                        value={newApiKeyName}
                        onChange={(e) => setNewApiKeyName(e.target.value)}
                        placeholder="Key display name"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      disabled={settingsBusy}
                      onClick={() =>
                        void runSettingsAction(
                          {
                            action: "generate_api_key",
                            service: newApiKeyService,
                            name: newApiKeyName,
                          },
                          "API key generated."
                        )
                      }
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Generate new API key
                    </Button>
                    {newlyGeneratedSecret && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <p className="font-medium text-emerald-700">Copy now (shown once)</p>
                        <p className="mt-1 font-mono text-emerald-700">{newlyGeneratedSecret}</p>
                      </div>
                    )}
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
                <SettingChip
                  icon={Plug}
                  label="Integrations"
                  value={`${[
                    featureMessagingEnabled,
                    featureMeetingsEnabled,
                    featureAnnouncementsEnabled,
                    ssoEnabled,
                    lmsEnabled,
                    calendarEnabled,
                  ].filter(Boolean).length} active`}
                />
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
