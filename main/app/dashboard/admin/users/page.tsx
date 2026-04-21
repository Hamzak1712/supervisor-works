"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  ShieldCheck,
  Search,
  Mail,
  CalendarDays,
  GraduationCap,
  Briefcase,
  Ban,
  RefreshCcw,
  UserPlus,
  Download,
  MoreHorizontal,
  KeyRound,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Trash2,
} from "lucide-react"
import type { User } from "@/types"

type UserStatus = "active" | "suspended" | "pending"
type UserRole = "Student" | "Supervisor" | "Admin"

type ApiUser = {
  id: string
  email: string
  role: "STUDENT" | "SUPERVISOR" | "ADMIN"
  status?: "ACTIVE" | "SUSPENDED" | "PENDING"
  createdAt: string
  studentProfile?: {
    fullName?: string | null
    skills?: string | null
    interests?: string | null
  } | null
  supervisorProfile?: {
    fullName?: string | null
    expertise?: string | null
    maxCapacity?: number | null
  } | null
}

type ApiUserDetails = ApiUser & {
  sessionVersion?: number
  updatedAt?: string
  assignedStudents?: Array<{
    id: string
    fullName?: string | null
    user: {
      id: string
      email: string
      project?: {
        id: string
        title?: string | null
        status: string
      } | null
    }
  }>
  project?: {
    id: string
    title?: string | null
    description?: string | null
    keywords?: string | null
    status: string
    milestones: Array<{
      id: string
      title: string
      status: string
      dueDate: string
    }>
  } | null
  _count?: {
    sentMessages: number
    receivedMessages: number
    meetingsOrganized: number
    meetingsAttending: number
    notifications: number
    sentRequests: number
    receivedRequests: number
  }
}

type ApiUserDetailsResponse = {
  user: ApiUserDetails
  metrics: {
    unreadNotifications: number
    pendingSentRequests: number
    pendingReceivedRequests: number
    acceptedSentRequests: number
    declinedSentRequests: number
    acceptedReceivedRequests: number
    declinedReceivedRequests: number
    completedMilestones: number
    totalMilestones: number
  }
}

interface UnifiedUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  avatarUrl?: string
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function mapRole(role: ApiUser["role"]): UserRole {
  if (role === "STUDENT") return "Student"
  if (role === "SUPERVISOR") return "Supervisor"
  return "Admin"
}

function mapApiUser(user: ApiUser): UnifiedUser {
  const uiRole = mapRole(user.role)
  const name =
    (uiRole === "Student"
      ? user.studentProfile?.fullName
      : uiRole === "Supervisor"
      ? user.supervisorProfile?.fullName
      : null) ||
    user.email.split("@")[0] ||
    "Unnamed User"

  const status: UserStatus =
    user.status === "SUSPENDED"
      ? "suspended"
      : user.status === "PENDING"
      ? "pending"
      : "active"

  return {
    id: user.id,
    name,
    email: user.email,
    role: uiRole,
    status,
    createdAt: formatShortDate(user.createdAt),
    avatarUrl: "",
  }
}

function escapeCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export default function AdminUsersPage() {
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [users, setUsers] = useState<UnifiedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionNotice, setActionNotice] = useState("")

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("student")
  const [inviteSent, setInviteSent] = useState(false)
  const [busyIds, setBusyIds] = useState<string[]>([])

  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailUser, setDetailUser] = useState<ApiUserDetails | null>(null)
  const [detailMetrics, setDetailMetrics] =
    useState<ApiUserDetailsResponse["metrics"] | null>(null)

  const authHeaders = () => {
    const token = localStorage.getItem("token")
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  function withBusy(id: string, busy: boolean) {
    setBusyIds((prev) =>
      busy ? [...new Set([...prev, id])] : prev.filter((existing) => existing !== id)
    )
  }

  async function fetchUsers(showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true)
      }
      setError("")
      const token = localStorage.getItem("token")

      const [meRes, usersRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const usersData = await usersRes.json()

      if (!usersRes.ok) {
        throw new Error(usersData?.error || "Failed to load users")
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

      const apiUsers: ApiUser[] = usersData.users || []
      setUsers(apiUsers.map(mapApiUser))
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load users.")
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchUsers(true)

    const intervalId = window.setInterval(() => {
      void fetchUsers()
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return users.filter((u) => {
      if (roleFilter !== "all" && u.role.toLowerCase() !== roleFilter) return false
      if (statusFilter !== "all" && u.status !== statusFilter) return false
      if (!q) return true

      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter, statusFilter])

  const stats = useMemo(() => {
    return {
      total: users.length,
      students: users.filter((u) => u.role === "Student").length,
      supervisors: users.filter((u) => u.role === "Supervisor").length,
      admins: users.filter((u) => u.role === "Admin").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      pending: users.filter((u) => u.status === "pending").length,
    }
  }, [users])

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function fetchUserDetails(id: string) {
    try {
      setDetailLoading(true)
      setError("")
      setDetailUserId(id)

      const res = await fetch(`/api/admin/users?id=${id}`, {
        headers: authHeaders(),
      })

      const data = (await res.json()) as ApiUserDetailsResponse | { error?: string }

      if (!res.ok || !("user" in data)) {
        throw new Error((data as { error?: string })?.error || "Failed to load user details")
      }

      setDetailUser(data.user)
      setDetailMetrics(data.metrics)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load user details.")
    } finally {
      setDetailLoading(false)
    }
  }

  async function setStatus(id: string, status: UserStatus) {
    try {
      withBusy(id, true)
      setError("")
      const apiStatus =
        status === "suspended"
          ? "SUSPENDED"
          : status === "pending"
          ? "PENDING"
          : "ACTIVE"

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          userId: id,
          status: apiStatus,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update user status")
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? mapApiUser(data.user) : u))
      )

      if (detailUserId === id) {
        fetchUserDetails(id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update user status.")
    } finally {
      withBusy(id, false)
    }
  }

  async function bulkSetStatus(status: UserStatus) {
    if (selectedIds.length === 0) return

    try {
      selectedIds.forEach((id) => withBusy(id, true))
      setError("")

      const apiStatus =
        status === "suspended"
          ? "SUSPENDED"
          : status === "pending"
          ? "PENDING"
          : "ACTIVE"

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          userIds: selectedIds,
          status: apiStatus,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update selected users")
      }

      if (Array.isArray(data?.users)) {
        const apiUsers = data.users as ApiUser[]
        const nextById = new Map<string, UnifiedUser>(
          apiUsers.map((apiUser) => [apiUser.id, mapApiUser(apiUser)])
        )
        setUsers((prev) =>
          prev.map((u) => nextById.get(u.id) ?? u)
        )
      }

      if (detailUserId && selectedIds.includes(detailUserId)) {
        fetchUserDetails(detailUserId)
      }

      setActionNotice(
        `${status === "suspended" ? "Suspended" : "Activated"} ${
          data?.updatedCount || selectedIds.length
        } user(s).`
      )
      setSelectedIds([])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update selected users.")
    } finally {
      selectedIds.forEach((id) => withBusy(id, false))
    }
  }

  async function updateRole(id: string, role: UserRole) {
    try {
      withBusy(id, true)
      setError("")
      const apiRole =
        role === "Student" ? "STUDENT" : role === "Supervisor" ? "SUPERVISOR" : "ADMIN"

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          userId: id,
          role: apiRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update role")
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? mapApiUser(data.user) : u))
      )

      if (detailUserId === id) {
        fetchUserDetails(id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update role.")
    } finally {
      withBusy(id, false)
    }
  }

  async function deleteUser(id: string) {
    try {
      withBusy(id, true)
      setError("")

      const res = await fetch(`/api/admin/users?userId=${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete user")
      }

      setUsers((prev) => prev.filter((u) => u.id !== id))
      setSelectedIds((prev) => prev.filter((x) => x !== id))

      if (detailUserId === id) {
        setDetailUserId(null)
        setDetailUser(null)
        setDetailMetrics(null)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not delete user.")
    } finally {
      withBusy(id, false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteEmail.includes("@")) return

    try {
      setInviteSent(true)
      setError("")
      const apiRole =
        inviteRole === "student"
          ? "STUDENT"
          : inviteRole === "supervisor"
          ? "SUPERVISOR"
          : "ADMIN"

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: apiRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to invite user")
      }

      setUsers((prev) => [mapApiUser(data.user), ...prev])
      setShowInvite(false)
      setInviteEmail("")
      setInviteRole("student")
      setActionNotice(
        `Pending account created for ${data.user.email}. Temporary password: ${data.temporaryPassword}`
      )
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not send invitation.")
    } finally {
      setInviteSent(false)
    }
  }

  async function resetPassword(id: string) {
    try {
      withBusy(id, true)
      setError("")

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          action: "reset_password",
          userId: id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset password")
      }

      setUsers((prev) => prev.map((u) => (u.id === id ? mapApiUser(data.user) : u)))
      if (detailUserId === id) {
        fetchUserDetails(id)
      }

      const userName = users.find((u) => u.id === id)?.name || "User"
      setActionNotice(`Password reset completed for ${userName}. Temporary password: ${data.temporaryPassword}`)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not reset password.")
    } finally {
      withBusy(id, false)
    }
  }

  async function endSessions(id: string) {
    try {
      withBusy(id, true)
      setError("")

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          action: "end_sessions",
          userId: id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to end sessions")
      }

      setUsers((prev) => prev.map((u) => (u.id === id ? mapApiUser(data.user) : u)))

      if (detailUserId === id) {
        fetchUserDetails(id)
      }

      const userName = users.find((u) => u.id === id)?.name || "User"
      setActionNotice(`All active sessions ended for ${userName}.`)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not end sessions.")
    } finally {
      withBusy(id, false)
    }
  }

  async function sendEmailToUsers(targetIds: string[]) {
    if (targetIds.length === 0) return

    const subject = window.prompt("Email subject", "Message from administrator")
    if (subject === null) return

    const message = window.prompt("Email body", "Please review your dashboard for updates.")
    if (message === null) return

    try {
      targetIds.forEach((id) => withBusy(id, true))
      setError("")

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          action: "send_email",
          userIds: targetIds,
          subject,
          message,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to send email")
      }

      if (targetIds.length === 1 && detailUserId === targetIds[0]) {
        fetchUserDetails(targetIds[0])
      }

      setActionNotice(`Message sent to ${data.sentCount || targetIds.length} user(s).`)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not send email.")
    } finally {
      targetIds.forEach((id) => withBusy(id, false))
    }
  }

  async function bulkResetPasswords() {
    if (selectedIds.length === 0) return

    const generated: string[] = []

    for (const id of selectedIds) {
      try {
        withBusy(id, true)

        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            action: "reset_password",
            userId: id,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || "Failed to reset password")
        }

        setUsers((prev) => prev.map((u) => (u.id === id ? mapApiUser(data.user) : u)))

        const userName = users.find((u) => u.id === id)?.name || data.user?.email || id
        generated.push(`${userName}: ${data.temporaryPassword}`)
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not reset one or more passwords.")
      } finally {
        withBusy(id, false)
      }
    }

    if (generated.length > 0) {
      setActionNotice(`Temporary passwords generated (${generated.length}): ${generated.join(" | ")}`)
    }

    setSelectedIds([])
  }

  function exportCsv() {
    const rows = filtered.length > 0 ? filtered : users

    const headers = [
      "name",
      "email",
      "role",
      "status",
      "createdAt",
    ]

    const csvRows = [
      headers.join(","),
      ...rows.map((u) =>
        [
          u.name,
          u.email,
          u.role,
          u.status,
          u.createdAt,
        ]
          .map((value) => escapeCsvValue(String(value)))
          .join(",")
      ),
    ]

    const csv = csvRows.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const now = new Date().toISOString().slice(0, 10)

    link.href = url
    link.setAttribute("download", `users-${now}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setActionNotice(`Exported ${rows.length} user row(s) to CSV.`)
  }

  if (loading) {
    return (
      <DashboardShell user={shellUser} role="admin" title="User Management">
        <div className="p-6">Loading users...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="User Management">
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

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">All Users</h2>
            <p className="text-sm text-muted-foreground">
              Review, invite, and manage every account on the platform
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setShowInvite((v) => !v)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite user
            </Button>
          </div>
        </div>

        {showInvite && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Invite a new user</CardTitle>
              <CardDescription>
                Create a pending account with a temporary password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="name@university.ac.uk"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Account will be provisioned with read-only access until profile is completed.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowInvite(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviteSent}>
                    {inviteSent ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Invitation sent
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send invitation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Users} label="Total Users" value={stats.total} tone="primary" />
          <StatCard icon={GraduationCap} label="Students" value={stats.students} tone="chart-2" />
          <StatCard icon={Briefcase} label="Supervisors" value={stats.supervisors} tone="success" />
          <StatCard icon={ShieldCheck} label="Admins" value={stats.admins} tone="primary" />
          <StatCard icon={AlertTriangle} label="Pending" value={stats.pending} tone="warning" />
          <StatCard icon={Ban} label="Suspended" value={stats.suspended} tone="destructive" />
        </div>

        <div className="grid gap-6 xl:grid-cols-4">
          <div className="space-y-6 xl:col-span-3">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
                        <Filter className="mr-2 h-3.5 w-3.5" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs value={roleFilter} onValueChange={setRoleFilter}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                    <TabsTrigger value="student">Students ({stats.students})</TabsTrigger>
                    <TabsTrigger value="supervisor">Supervisors ({stats.supervisors})</TabsTrigger>
                    <TabsTrigger value="admin">Admins ({stats.admins})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {selectedIds.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm font-medium">
                    <span className="text-primary">{selectedIds.length}</span> selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => bulkSetStatus("active")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Activate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => bulkSetStatus("suspended")}>
                      <Ban className="mr-2 h-4 w-4" />
                      Suspend
                    </Button>
                    <Button variant="outline" size="sm" onClick={bulkResetPasswords}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Reset passwords
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendEmailToUsers(selectedIds)}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send email
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Registered Accounts</CardTitle>
                  <CardDescription>
                    Showing {filtered.length} of {stats.total} users
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No users match your filters</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search or filters.
                    </p>
                  </div>
                ) : (
                  filtered.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      selected={selectedIds.includes(user.id)}
                      busy={busyIds.includes(user.id)}
                      onToggleSelect={() => toggleSelected(user.id)}
                      onSetStatus={(status) => setStatus(user.id, status)}
                      onDelete={() => deleteUser(user.id)}
                      onRoleChange={(role) => updateRole(user.id, role)}
                      onView={() => fetchUserDetails(user.id)}
                      onResetPassword={() => resetPassword(user.id)}
                      onEndSessions={() => endSessions(user.id)}
                      onSendEmail={() => sendEmailToUsers([user.id])}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Total accounts" value={stats.total} />
                <SummaryRow label="Students" value={stats.students} />
                <SummaryRow label="Supervisors" value={stats.supervisors} />
                <SummaryRow label="Admins" value={stats.admins} />
                <Separator />
                <SummaryRow
                  label="Active"
                  value={users.filter((u) => u.status === "active").length}
                  tone="success"
                />
                <SummaryRow label="Pending onboarding" value={stats.pending} tone="warning" />
                <SummaryRow label="Suspended" value={stats.suspended} tone="destructive" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selected User Details</CardTitle>
                <CardDescription>
                  {detailUserId ? "Live data from the database" : "Click View on a user row"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!detailUserId && (
                  <p className="text-muted-foreground">No user selected yet.</p>
                )}

                {detailLoading && <p className="text-muted-foreground">Loading details...</p>}

                {!detailLoading && detailUser && (
                  <>
                    <div>
                      <p className="font-medium">
                        {detailUser.studentProfile?.fullName ||
                          detailUser.supervisorProfile?.fullName ||
                          detailUser.email}
                      </p>
                      <p className="text-muted-foreground">{detailUser.email}</p>
                    </div>
                    <SummaryRow label="Role" valueText={mapRole(detailUser.role)} />
                    <SummaryRow
                      label="Status"
                      valueText={
                        detailUser.status === "SUSPENDED"
                          ? "Suspended"
                          : detailUser.status === "PENDING"
                          ? "Pending"
                          : "Active"
                      }
                    />
                    <SummaryRow
                      label="Joined"
                      valueText={formatShortDate(detailUser.createdAt)}
                    />
                    <SummaryRow
                      label="Last update"
                      valueText={
                        detailUser.updatedAt ? formatShortDate(detailUser.updatedAt) : "Unknown"
                      }
                    />
                    <Separator />

                    {detailUser.role === "STUDENT" && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Student Profile
                        </p>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Skills</p>
                          {splitCsv(detailUser.studentProfile?.skills).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {splitCsv(detailUser.studentProfile?.skills).map((skill) => (
                                <Badge key={skill} variant="outline">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No skills added yet.</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Interests</p>
                          {splitCsv(detailUser.studentProfile?.interests).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {splitCsv(detailUser.studentProfile?.interests).map((interest) => (
                                <Badge key={interest} variant="secondary">
                                  {interest}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No interests added yet.</p>
                          )}
                        </div>
                        <SummaryRow
                          label="Project"
                          valueText={detailUser.project?.title || "No project title yet"}
                        />
                        <SummaryRow
                          label="Project status"
                          valueText={detailUser.project?.status || "N/A"}
                        />
                        <SummaryRow
                          label="Project keywords"
                          valueText={detailUser.project?.keywords || "No keywords yet"}
                        />
                      </>
                    )}

                    {detailUser.role === "SUPERVISOR" && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Supervisor Profile
                        </p>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Expertise</p>
                          {splitCsv(detailUser.supervisorProfile?.expertise).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {splitCsv(detailUser.supervisorProfile?.expertise).map((expertise) => (
                                <Badge key={expertise} variant="outline">
                                  {expertise}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No expertise added yet.</p>
                          )}
                        </div>
                        <SummaryRow
                          label="Capacity"
                          valueText={
                            detailUser.supervisorProfile?.maxCapacity !== null &&
                            detailUser.supervisorProfile?.maxCapacity !== undefined
                              ? `${detailUser.assignedStudents?.length || 0}/${
                                  detailUser.supervisorProfile.maxCapacity
                                } assigned`
                              : `${detailUser.assignedStudents?.length || 0} assigned`
                          }
                        />
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Assigned students</p>
                          {detailUser.assignedStudents && detailUser.assignedStudents.length > 0 ? (
                            <div className="space-y-1.5">
                              {detailUser.assignedStudents.map((student) => (
                                <div key={student.id} className="rounded border p-2 text-xs">
                                  <p className="font-medium">
                                    {student.fullName || student.user.email}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {student.user.project?.title || "No project title yet"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No assigned students yet.</p>
                          )}
                        </div>
                      </>
                    )}

                    <Separator />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Activity Stats
                    </p>
                    <SummaryRow
                      label="Requests (sent/received)"
                      valueText={`${detailUser._count?.sentRequests || 0}/${
                        detailUser._count?.receivedRequests || 0
                      }`}
                    />
                    <SummaryRow
                      label="Requests pending (sent/received)"
                      valueText={
                        detailMetrics
                          ? `${detailMetrics.pendingSentRequests}/${detailMetrics.pendingReceivedRequests}`
                          : "0/0"
                      }
                    />
                    <SummaryRow
                      label="Requests accepted (sent/received)"
                      valueText={
                        detailMetrics
                          ? `${detailMetrics.acceptedSentRequests}/${detailMetrics.acceptedReceivedRequests}`
                          : "0/0"
                      }
                    />
                    <SummaryRow
                      label="Requests declined (sent/received)"
                      valueText={
                        detailMetrics
                          ? `${detailMetrics.declinedSentRequests}/${detailMetrics.declinedReceivedRequests}`
                          : "0/0"
                      }
                    />
                    <SummaryRow
                      label="Milestones"
                      valueText={
                        detailMetrics
                          ? `${detailMetrics.completedMilestones}/${detailMetrics.totalMilestones} completed`
                          : "N/A"
                      }
                    />
                    <SummaryRow
                      label="Unread notifications"
                      value={detailMetrics?.unreadNotifications || 0}
                    />
                    <SummaryRow
                      label="Messages (sent/received)"
                      valueText={`${detailUser._count?.sentMessages || 0}/${
                        detailUser._count?.receivedMessages || 0
                      }`}
                    />
                    <SummaryRow
                      label="Meetings (org/att)"
                      valueText={`${detailUser._count?.meetingsOrganized || 0}/${
                        detailUser._count?.meetingsAttending || 0
                      }`}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Role Privileges</CardTitle>
                <CardDescription>What each role can do</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <RoleBlock
                  icon={GraduationCap}
                  name="Student"
                  perms={["Submit project", "Match with supervisors", "Track milestones"]}
                />
                <RoleBlock
                  icon={Briefcase}
                  name="Supervisor"
                  perms={["Review requests", "Manage students", "Update capacity"]}
                />
                <RoleBlock
                  icon={ShieldCheck}
                  name="Admin"
                  perms={["Full platform control", "Manage all users", "System settings"]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Admin Guidance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Suspending a user revokes access immediately while preserving their data for compliance review.
                </p>
                <p>
                  Password resets generate a temporary password and automatically invalidate existing sessions.
                </p>
                <p>
                  Role changes are logged in the audit trail and require two-factor confirmation for admin escalations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function UserRow({
  user,
  selected,
  busy,
  onToggleSelect,
  onSetStatus,
  onDelete,
  onRoleChange,
  onView,
  onResetPassword,
  onEndSessions,
  onSendEmail,
}: {
  user: UnifiedUser
  selected: boolean
  busy: boolean
  onToggleSelect: () => void
  onSetStatus: (status: UserStatus) => void
  onDelete: () => void
  onRoleChange: (role: UserRole) => void
  onView: () => void
  onResetPassword: () => void
  onEndSessions: () => void
  onSendEmail: () => void
}) {
  const roleTone =
    user.role === "Student"
      ? "border-chart-2/30 bg-chart-2/10 text-chart-2"
      : user.role === "Supervisor"
      ? "border-success/30 bg-success/10 text-success"
      : "border-primary/30 bg-primary/10 text-primary"

  const statusTone =
    user.status === "active"
      ? "border-success/30 bg-success/10 text-success"
      : user.status === "pending"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-destructive/30 bg-destructive/10 text-destructive"

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-2 h-4 w-4 shrink-0 rounded border-border accent-primary"
            aria-label={`Select ${user.name}`}
          />
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{user.name}</h3>
              <Badge variant="outline" className={roleTone}>
                {user.role}
              </Badge>
              <Badge variant="outline" className={statusTone}>
                {user.status === "active" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {user.status === "pending" && <AlertTriangle className="mr-1 h-3 w-3" />}
                {user.status === "suspended" && <XCircle className="mr-1 h-3 w-3" />}
                {user.status.toUpperCase()}
              </Badge>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
              <span className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {user.createdAt}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 xl:shrink-0">
          <Button variant="outline" size="sm" onClick={onView} disabled={busy}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>

          {user.status === "suspended" ? (
            <Button size="sm" onClick={() => onSetStatus("active")} disabled={busy}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Reactivate
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRoleChange("Student")}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Make Student
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRoleChange("Supervisor")}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Make Supervisor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRoleChange("Admin")}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Make Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onResetPassword}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEndSessions}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  End all sessions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSendEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetStatus("suspended")}>
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
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
  value: number
  tone: "primary" | "success" | "warning" | "chart-2" | "destructive"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    "chart-2": "bg-chart-2/10 text-chart-2",
    destructive: "bg-destructive/10 text-destructive",
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
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

function SummaryRow({
  label,
  value,
  valueText,
  tone,
}: {
  label: string
  value?: number
  valueText?: string
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
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-semibold tabular-nums ${toneClass}`}>
        {valueText ?? value ?? 0}
      </span>
    </div>
  )
}

function RoleBlock({
  icon: Icon,
  name,
  perms,
}: {
  icon: React.ComponentType<{ className?: string }>
  name: string
  perms: string[]
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium">{name}</span>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {perms.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
