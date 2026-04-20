"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { currentSupervisor, expertiseTags, getStudentsBySupervisor } from "@/lib/mock-data"
import {
  ArrowRight,
  Briefcase,
  Camera,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  Layers,
  Mail,
  Pencil,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function SupervisorProfilePage() {
  const currentStudents = useMemo(
    () => getStudentsBySupervisor(currentSupervisor.id),
    []
  )

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(currentSupervisor.name)
  const [email, setEmail] = useState(currentSupervisor.email)
  const [department, setDepartment] = useState(currentSupervisor.department)
  const [bio, setBio] = useState(currentSupervisor.bio)
  const [expertise, setExpertise] = useState<string[]>(currentSupervisor.expertise)
  const [researchAreas, setResearchAreas] = useState<string[]>(
    currentSupervisor.researchAreas
  )
  const [pastProjects, setPastProjects] = useState<string[]>(
    currentSupervisor.pastProjects
  )
  const [maxStudents, setMaxStudents] = useState(currentSupervisor.maxStudents)
  const [acceptingStudents, setAcceptingStudents] = useState(true)
  const [publicProfile, setPublicProfile] = useState(true)

  const [newExpertise, setNewExpertise] = useState("")
  const [newResearch, setNewResearch] = useState("")
  const [newProject, setNewProject] = useState("")

  const capacity = maxStudents > 0 ? Math.round((currentStudents.length / maxStudents) * 100) : 0
  const remainingCapacity = Math.max(maxStudents - currentStudents.length, 0)

  // Profile strength
  const strength = useMemo(() => {
    let score = 0
    if (bio.trim().length >= 40) score += 20
    if (expertise.length >= 3) score += 20
    if (researchAreas.length >= 2) score += 20
    if (pastProjects.length >= 2) score += 20
    if (department.trim()) score += 10
    if (name.trim() && email.trim()) score += 10
    return score
  }, [bio, expertise, researchAreas, pastProjects, department, name, email])

  function addExpertise() {
    const t = newExpertise.trim()
    if (!t || expertise.includes(t)) return
    setExpertise([...expertise, t])
    setNewExpertise("")
  }
  function removeExpertise(t: string) {
    setExpertise(expertise.filter((x) => x !== t))
  }
  function addResearch() {
    const t = newResearch.trim()
    if (!t || researchAreas.includes(t)) return
    setResearchAreas([...researchAreas, t])
    setNewResearch("")
  }
  function removeResearch(t: string) {
    setResearchAreas(researchAreas.filter((x) => x !== t))
  }
  function addProject() {
    const t = newProject.trim()
    if (!t || pastProjects.includes(t)) return
    setPastProjects([...pastProjects, t])
    setNewProject("")
  }
  function removeProject(t: string) {
    setPastProjects(pastProjects.filter((x) => x !== t))
  }

  const suggestedTags = expertiseTags.filter((t) => !expertise.includes(t)).slice(0, 6)

  return (
    <DashboardShell user={currentSupervisor} role="supervisor" title="My Profile">
      {/* Hero header */}
      <Card className="mb-6 overflow-hidden">
        <div className="relative h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent md:h-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
          {editing ? (
            <Button
              size="sm"
              variant="secondary"
              className="absolute right-4 top-4 gap-2"
            >
              <Camera className="h-4 w-4" />
              Change cover
            </Button>
          ) : null}
        </div>

        <CardContent className="-mt-12 space-y-6 pb-6 md:-mt-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-card shadow-sm md:h-28 md:w-28">
                  <AvatarImage
                    src={currentSupervisor.avatarUrl || "/placeholder.svg"}
                    alt={currentSupervisor.name}
                  />
                  <AvatarFallback className="text-xl">
                    {currentSupervisor.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                {editing ? (
                  <button
                    type="button"
                    aria-label="Change photo"
                    className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold leading-tight text-balance md:text-3xl">
                    {name}
                  </h1>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Supervisor
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{department}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {currentStudents.length} / {maxStudents} supervising
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setEditing(false)}>
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/supervisor/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </Button>
                  <Button onClick={() => setEditing(true)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit profile
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left: tabbed content */}
        <div className="xl:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expertise">Expertise</TabsTrigger>
              <TabsTrigger value="projects">Past Projects</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserRound className="h-4 w-4 text-primary" />
                    Basic information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!editing}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!editing}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dept">Department</Label>
                    <Input
                      id="dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={!editing}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Pencil className="h-4 w-4 text-primary" />
                    Professional bio
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    A short summary that appears on your public profile and in match results.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={!editing}
                    rows={5}
                    placeholder="Describe your background, research focus, and supervision style..."
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {bio.length} characters
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Expertise */}
            <TabsContent value="expertise" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Expertise
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Tags used to match you with student projects.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {expertise.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="gap-1.5 py-1 pl-3 pr-1 font-normal"
                      >
                        {t}
                        {editing ? (
                          <button
                            type="button"
                            onClick={() => removeExpertise(t)}
                            aria-label={`Remove ${t}`}
                            className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                    {expertise.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No expertise tags added.</p>
                    ) : null}
                  </div>

                  {editing ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add expertise (e.g. Deep Learning)"
                          value={newExpertise}
                          onChange={(e) => setNewExpertise(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addExpertise()
                            }
                          }}
                        />
                        <Button type="button" onClick={addExpertise}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </div>

                      {suggestedTags.length > 0 ? (
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            Suggested tags
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedTags.map((t) => (
                              <button
                                type="button"
                                key={t}
                                onClick={() => setExpertise([...expertise, t])}
                                className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                              >
                                + {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Research areas
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Active themes across your supervised work.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {researchAreas.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="gap-1.5 py-1 pl-3 pr-1 font-normal"
                      >
                        {t}
                        {editing ? (
                          <button
                            type="button"
                            onClick={() => removeResearch(t)}
                            aria-label={`Remove ${t}`}
                            className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                    {researchAreas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No research areas added.</p>
                    ) : null}
                  </div>

                  {editing ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add research area (e.g. AI in Healthcare)"
                        value={newResearch}
                        onChange={(e) => setNewResearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addResearch()
                          }
                        }}
                      />
                      <Button type="button" onClick={addResearch}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Past projects */}
            <TabsContent value="projects" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Previously supervised projects
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Highlight past dissertations students can reference.
                    </p>
                  </div>
                  <Badge variant="secondary">{pastProjects.length} projects</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editing ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add project title"
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addProject()
                          }
                        }}
                      />
                      <Button type="button" onClick={addProject}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  ) : null}

                  {pastProjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No past projects added yet.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {pastProjects.map((title, i) => (
                        <li
                          key={title}
                          className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Layers className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Project {i + 1}
                              </p>
                              <p className="font-medium leading-snug">{title}</p>
                              <p className="text-xs text-muted-foreground">
                                Abstract, outcomes, and linked report will appear here.
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="h-4 w-4" />
                              <span className="sr-only">View project</span>
                            </Button>
                            {editing ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeProject(title)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove project</span>
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Availability */}
            <TabsContent value="availability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-4 w-4 text-primary" />
                    Supervision capacity
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Control how many students can be assigned to you.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current load</p>
                        <p className="mt-1 text-2xl font-bold">
                          {currentStudents.length}
                          <span className="text-base font-medium text-muted-foreground">
                            {" "}
                            / {maxStudents}
                          </span>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          capacity >= 90
                            ? "border-warning/40 text-warning"
                            : "border-success/40 text-success"
                        )}
                      >
                        {remainingCapacity} spot{remainingCapacity === 1 ? "" : "s"} left
                      </Badge>
                    </div>
                    <Progress
                      value={capacity}
                      className={cn("mt-4 h-2", capacity >= 90 && "[&>div]:bg-warning")}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="max">Maximum students</Label>
                      <Input
                        id="max"
                        type="number"
                        min={1}
                        max={20}
                        value={maxStudents}
                        onChange={(e) =>
                          setMaxStudents(Math.max(1, Number(e.target.value) || 1))
                        }
                        disabled={!editing}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="accepting" className="text-sm">
                          Accepting new students
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Show in AI match results.
                        </p>
                      </div>
                      <Switch
                        id="accepting"
                        checked={acceptingStudents}
                        onCheckedChange={setAcceptingStudents}
                        disabled={!editing}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="public" className="text-sm">
                          Public profile
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Make your profile visible to all students.
                        </p>
                      </div>
                      <Switch
                        id="public"
                        checked={publicProfile}
                        onCheckedChange={setPublicProfile}
                        disabled={!editing}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Profile strength */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Profile strength</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completeness</span>
                  <span className="font-semibold">{strength}%</span>
                </div>
                <Progress value={strength} className="h-2" />
              </div>

              <ul className="space-y-2 text-sm">
                {[
                  { label: "Biography (40+ chars)", ok: bio.trim().length >= 40 },
                  { label: "3+ expertise tags", ok: expertise.length >= 3 },
                  { label: "2+ research areas", ok: researchAreas.length >= 2 },
                  { label: "2+ past projects", ok: pastProjects.length >= 2 },
                  { label: "Contact details", ok: Boolean(name && email && department) },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4 shrink-0",
                        item.ok ? "text-success" : "text-muted-foreground/50"
                      )}
                    />
                    <span
                      className={cn(
                        item.ok ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Current students */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Current students</CardTitle>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/supervisor/students">
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {currentStudents.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  You have no students right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {currentStudents.slice(0, 3).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <Avatar className="h-9 w-9 border">
                        <AvatarImage src={s.avatarUrl || "/placeholder.svg"} alt="" />
                        <AvatarFallback>
                          {s.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.degree}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Tips / quick actions */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Grow your profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                A detailed profile improves your AI match score by up to 40%. Students are
                more likely to send well-prepared proposals when they can see your past
                work.
              </p>
              <Button asChild variant="outline" className="w-full bg-background/60">
                <Link href="/dashboard/supervisor/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Profile settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
