"use client"

import { useEffect, useMemo, useState } from "react"
import {
  User as UserIcon,
  Mail,
  GraduationCap,
  Building2,
  Calendar,
  Sparkles,
  Brain,
  Shield,
  Pencil,
  Save,
  X,
  Plus,
  Camera,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Target,
  TrendingUp,
  Lock,
  KeyRound,
  BellRing,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { currentStudent, expertiseTags } from "@/lib/mock-data"

type StudentProfileApi = {
  fullName: string | null
  skills: string | null
  interests: string | null
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function splitCsv(value: string | null) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState("")

  const [profile, setProfile] = useState<StudentProfileApi | null>(null)

  const [name, setName] = useState(currentStudent.name)
  const [email] = useState(currentStudent.email)
  const [degree, setDegree] = useState(currentStudent.degree)
  const [department, setDepartment] = useState(currentStudent.department)
  const [yearOfStudy, setYearOfStudy] = useState(String(currentStudent.yearOfStudy))
  const [availability, setAvailability] = useState<"full-time" | "part-time">(
    currentStudent.availability
  )
  const [bio, setBio] = useState(
    "MSc Computer Science student passionate about applying NLP and deep learning to real-world writing assistance tools."
  )

  const [skills, setSkills] = useState<string[]>(currentStudent.skills)
  const [interests, setInterests] = useState<string[]>(currentStudent.researchInterests)
  const [newSkill, setNewSkill] = useState("")
  const [newInterest, setNewInterest] = useState("")

  const [notifyMatches, setNotifyMatches] = useState(true)
  const [notifyMilestones, setNotifyMilestones] = useState(true)
  const [notifyMessages, setNotifyMessages] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    async function fetchProfile() {
      try {
        setError("")
        const token = localStorage.getItem("token")

        const res = await fetch("/api/student/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load profile")
        }

        const dbProfile: StudentProfileApi = data.profile
        setProfile(dbProfile)

        if (dbProfile?.fullName) {
          setName(dbProfile.fullName)
        }

        if (dbProfile?.skills) {
          setSkills(splitCsv(dbProfile.skills))
        }

        if (dbProfile?.interests) {
          setInterests(splitCsv(dbProfile.interests))
        }
      } catch (err) {
        console.error(err)
        setError("Could not load your profile from the database.")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleSave = async () => {
    try {
      setError("")
      const token = localStorage.getItem("token")

      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: name,
          skills: skills.join(", "),
          interests: interests.join(", "),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save profile")
      }

      setProfile(data.profile)
      setIsEditing(false)
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 2200)
    } catch (err) {
      console.error(err)
      setError("Could not save your profile changes.")
    }
  }

  const handleAddSkill = () => {
    const trimmed = newSkill.trim()
    if (!trimmed || skills.includes(trimmed)) return
    setSkills([...skills, trimmed])
    setNewSkill("")
  }

  const handleAddInterest = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || interests.includes(trimmed)) return
    setInterests([...interests, trimmed])
    setNewInterest("")
  }

  const completion = useMemo(() => {
    const checks = [
      Boolean(name),
      Boolean(email),
      Boolean(degree),
      Boolean(department),
      Boolean(yearOfStudy),
      Boolean(bio.length > 20),
      skills.length >= 3,
      interests.length >= 2,
    ]
    const completed = checks.filter(Boolean).length
    return Math.round((completed / checks.length) * 100)
  }, [name, email, degree, department, yearOfStudy, bio, skills, interests])

  const strengthLabel =
    completion >= 90
      ? "Excellent"
      : completion >= 70
      ? "Strong"
      : completion >= 50
      ? "Good"
      : "Needs work"

  const improvements = [
    { done: bio.length > 20, text: "Write a short bio (20+ characters)" },
    { done: skills.length >= 5, text: "Add at least 5 technical skills" },
    { done: interests.length >= 3, text: "Add 3 or more research interests" },
    { done: Boolean(currentStudent.avatarUrl), text: "Upload a profile photo" },
  ]

  const interestSuggestions = expertiseTags.filter((t) => !interests.includes(t)).slice(0, 6)

  if (loading) {
    return (
      <DashboardShell user={currentStudent} role="student" title="My Profile">
        <div className="p-6">Loading profile...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={currentStudent} role="student" title="My Profile">
      <Card className="overflow-hidden border-border/60">
        <div className="h-24 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="-mt-12 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-primary/20">
                <AvatarImage src={currentStudent.avatarUrl || "/placeholder.svg"} alt={name} />
                <AvatarFallback className="bg-primary/10 text-xl text-primary">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                  aria-label="Change photo"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">{name}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" className="capitalize">
                  {availability}
                </Badge>
                <Badge variant="outline">Year {yearOfStudy}</Badge>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  <GraduationCap className="mr-1 h-3 w-3" />
                  {degree}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {justSaved && (
              <span className="flex items-center gap-1 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            )}
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-6 border-red-500/30">
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="academic">Academic</TabsTrigger>
              <TabsTrigger value="skills">Skills &amp; Interests</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserIcon className="h-5 w-5 text-primary" />
                    Personal information
                  </CardTitle>
                  <CardDescription>
                    This information helps supervisors and the matching engine understand who you are.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">University email</Label>
                      <Input id="email" type="email" value={email} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Short bio</Label>
                    <Textarea
                      id="bio"
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      disabled={!isEditing}
                      placeholder="A few sentences about your background, goals and interests."
                    />
                    <p className="text-xs text-muted-foreground">
                      {bio.length} characters · aim for at least 80 for best matches.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="break-all">{email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{department}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined {new Date(currentStudent.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Quick facts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Skills</span>
                      <span className="font-medium">{skills.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Research interests</span>
                      <span className="font-medium">{interests.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Availability</span>
                      <span className="font-medium capitalize">{availability}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="academic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Academic details
                  </CardTitle>
                  <CardDescription>
                    Your programme information. Changes to your degree or department require admin approval.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="degree">Degree programme</Label>
                      <Input
                        id="degree"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year of study</Label>
                      <Select
                        value={yearOfStudy}
                        onValueChange={setYearOfStudy}
                        disabled={!isEditing}
                      >
                        <SelectTrigger id="year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Year 1</SelectItem>
                          <SelectItem value="2">Year 2</SelectItem>
                          <SelectItem value="3">Year 3</SelectItem>
                          <SelectItem value="4">Year 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="availability">Availability</Label>
                      <Select
                        value={availability}
                        onValueChange={(v) => setAvailability(v as "full-time" | "part-time")}
                        disabled={!isEditing}
                      >
                        <SelectTrigger id="availability">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skills" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Technical skills
                  </CardTitle>
                  <CardDescription>
                    List tools, frameworks and languages you are confident working with.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {skills.length === 0 && (
                      <p className="text-sm text-muted-foreground">No skills added yet.</p>
                    )}
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1 py-1 pr-1 text-sm">
                        {skill}
                        {isEditing && (
                          <button
                            type="button"
                            aria-label={`Remove ${skill}`}
                            onClick={() => setSkills(skills.filter((s) => s !== skill))}
                            className="rounded-full p-0.5 transition-colors hover:bg-background"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>

                  {isEditing && (
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add a skill (e.g. TypeScript)"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddSkill()
                          }
                        }}
                      />
                      <Button onClick={handleAddSkill} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-primary" />
                    Research interests
                  </CardTitle>
                  <CardDescription>
                    Topics you would like to explore in your project. These drive supervisor matches.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {interests.length === 0 && (
                      <p className="text-sm text-muted-foreground">No interests added yet.</p>
                    )}
                    {interests.map((i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="gap-1 border-primary/30 py-1 pr-1 text-sm text-primary"
                      >
                        {i}
                        {isEditing && (
                          <button
                            type="button"
                            aria-label={`Remove ${i}`}
                            onClick={() => setInterests(interests.filter((v) => v !== i))}
                            className="rounded-full p-0.5 transition-colors hover:bg-primary/10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>

                  {isEditing && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          placeholder="Add an interest (e.g. Natural Language Processing)"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleAddInterest(newInterest)
                            }
                          }}
                        />
                        <Button onClick={() => handleAddInterest(newInterest)} variant="outline">
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </div>

                      {interestSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Popular suggestions
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {interestSuggestions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddInterest(tag)}
                                className="rounded-full border border-dashed border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BellRing className="h-5 w-5 text-primary" />
                    Notification preferences
                  </CardTitle>
                  <CardDescription>
                    Choose what we email you about. You can change these any time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">New supervisor matches</p>
                      <p className="text-xs text-muted-foreground">
                        Get notified when a strong match is available.
                      </p>
                    </div>
                    <Switch checked={notifyMatches} onCheckedChange={setNotifyMatches} />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">Milestone reminders</p>
                      <p className="text-xs text-muted-foreground">
                        Reminders 7 and 2 days before a milestone is due.
                      </p>
                    </div>
                    <Switch checked={notifyMilestones} onCheckedChange={setNotifyMilestones} />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">Supervisor messages</p>
                      <p className="text-xs text-muted-foreground">
                        Every time your supervisor posts a comment or feedback.
                      </p>
                    </div>
                    <Switch checked={notifyMessages} onCheckedChange={setNotifyMessages} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="h-5 w-5 text-primary" />
                    Security
                  </CardTitle>
                  <CardDescription>
                    Update your password. Use at least 12 characters with a mix of letters and numbers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button variant="outline" className="w-fit">
                    <KeyRound className="mr-2 h-4 w-4" />
                    Update password
                  </Button>

                  <Separator />

                  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-medium">Two-factor authentication</p>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of security with a time-based code.
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Shield className="mr-2 h-4 w-4" />
                      Enable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Profile strength
              </CardTitle>
              <CardDescription>
                Complete profiles receive better supervisor recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-semibold">{completion}%</span>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {strengthLabel}
                  </Badge>
                </div>
                <Progress value={completion} className="h-2" />
              </div>

              <Separator />

              <ul className="space-y-2 text-sm">
                {improvements.map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-primary" />
                Profile tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Keep your skills updated so the matching engine can recommend supervisors that
                align with your abilities.
              </p>
              <p>
                Add specific research interests such as <span className="text-foreground">NLP</span>,{" "}
                <span className="text-foreground">Computer Vision</span> or{" "}
                <span className="text-foreground">Data Analytics</span> rather than broad terms.
              </p>
              <p>
                A complete profile with a bio and avatar results in{" "}
                <span className="text-foreground">3x</span> more relevant supervisor matches.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Next step
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Your profile looks great. Find a supervisor who matches your research interests.
              </p>
              <Button className="w-full" asChild>
                <a href="/dashboard/student/matching">Find a supervisor</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}