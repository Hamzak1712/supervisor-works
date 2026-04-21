"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { User } from "@/types"
import { ShieldCheck, ShieldAlert, UserCog, Eye } from "lucide-react"

type PermissionItem = {
  id: string
  key: string
  name: string
  category: string
  description: string | null
}

type RoleItem = {
  id: string
  slug: string
  name: string
  description: string | null
  isSystem: boolean
  baseRole: "STUDENT" | "SUPERVISOR" | "ADMIN" | null
  permissions: string[]
  assignedUsersCount: number
}

type AssignmentItem = {
  id: string
  userId: string
  userEmail: string
  roleId: string
  roleSlug: string
  roleName: string
  createdAt: string
  assignedByEmail: string | null
}

type GovernancePayload = {
  permissions: PermissionItem[]
  roles: RoleItem[]
  assignments: AssignmentItem[]
  users: Array<{
    id: string
    email: string
    role: "STUDENT" | "SUPERVISOR" | "ADMIN"
    status: "ACTIVE" | "SUSPENDED" | "PENDING"
  }>
  auditLogs: Array<{
    id: string
    actorEmail: string | null
    actorRole: string | null
    targetUserId: string | null
    action: string
    resource: string | null
    resourceId: string | null
    metadata: unknown
    createdAt: string
  }>
}

const fallbackShellUser: User = {
  id: "admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  createdAt: new Date(0).toISOString(),
}

export default function AdminRbacPage() {
  const router = useRouter()
  const [shellUser, setShellUser] = useState<User>(fallbackShellUser)
  const [payload, setPayload] = useState<GovernancePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleSlug, setNewRoleSlug] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")

  const [assignmentUserId, setAssignmentUserId] = useState("")
  const [assignmentRoleId, setAssignmentRoleId] = useState("")

  const [impersonateTargetUserId, setImpersonateTargetUserId] = useState("")
  const [impersonateReason, setImpersonateReason] = useState("")

  function authHeaders() {
    const token = localStorage.getItem("token")
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchData(showLoading = false) {
    try {
      if (showLoading) setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const [meRes, rbacRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("/api/admin/rbac", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ])

      const meData = await meRes.json()
      const rbacData = (await rbacRes.json()) as GovernancePayload | { error?: string }

      if (!rbacRes.ok || !("roles" in rbacData)) {
        throw new Error((rbacData as { error?: string })?.error || "Failed to load role governance")
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

      setPayload(rbacData)
      if (!assignmentUserId && rbacData.users[0]) {
        setAssignmentUserId(rbacData.users[0].id)
      }
      if (!assignmentRoleId && rbacData.roles[0]) {
        setAssignmentRoleId(rbacData.roles[0].id)
      }
      if (!impersonateTargetUserId && rbacData.users[0]) {
        setImpersonateTargetUserId(rbacData.users[0].id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not load role governance.")
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function runAction(
    body: Record<string, unknown>,
    successNotice: string,
    options?: { refresh?: boolean }
  ) {
    try {
      setBusy(true)
      setError("")

      const res = await fetch("/api/admin/rbac", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as GovernancePayload | { error?: string }
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || "Action failed")
      }

      if ("roles" in data) {
        setPayload(data)
      }

      setNotice(successNotice)
      if (options?.refresh) {
        await fetchData()
      }
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  async function createRole() {
    if (!newRoleName.trim()) return
    await runAction(
      {
        action: "create_role",
        name: newRoleName,
        slug: newRoleSlug,
        description: newRoleDescription,
      },
      "Custom role created."
    )
    setNewRoleName("")
    setNewRoleSlug("")
    setNewRoleDescription("")
  }

  async function assignRole() {
    if (!assignmentUserId || !assignmentRoleId) return
    await runAction(
      {
        action: "assign_role",
        userId: assignmentUserId,
        roleId: assignmentRoleId,
      },
      "Role assigned."
    )
  }

  async function impersonateUser() {
    if (!impersonateTargetUserId) return

    try {
      setBusy(true)
      setError("")
      const currentToken = localStorage.getItem("token")

      const res = await fetch("/api/admin/rbac", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          action: "impersonate_user",
          targetUserId: impersonateTargetUserId,
          reason: impersonateReason,
        }),
      })

      const data = (await res.json()) as
        | { token: string; user: { id: string; email: string; role: string } }
        | { error?: string }

      if (!res.ok || !("token" in data)) {
        throw new Error((data as { error?: string })?.error || "Failed to impersonate user")
      }

      if (currentToken) {
        localStorage.setItem("impersonationAdminToken", currentToken)
      }
      localStorage.setItem("token", data.token)
      localStorage.setItem("userId", data.user.id)
      localStorage.setItem("userEmail", data.user.email)
      localStorage.setItem("userRole", data.user.role.toLowerCase())
      localStorage.setItem("impersonationActive", "true")
      router.push(`/dashboard/${data.user.role.toLowerCase()}`)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Impersonation failed.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void fetchData(true)
  }, [])

  const groupedPermissions = useMemo(() => {
    if (!payload) return []
    const groupMap = new Map<string, PermissionItem[]>()
    for (const permission of payload.permissions) {
      const existing = groupMap.get(permission.category) || []
      existing.push(permission)
      groupMap.set(permission.category, existing)
    }
    return Array.from(groupMap.entries()).map(([category, items]) => ({
      category,
      items,
    }))
  }, [payload])

  if (loading || !payload) {
    return (
      <DashboardShell user={shellUser} role="admin" title="Role Governance">
        <div className="p-6">Loading role governance...</div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell user={shellUser} role="admin" title="Role Governance">
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ShieldCheck} label="Roles" value={String(payload.roles.length)} />
          <MetricCard icon={UserCog} label="Permissions" value={String(payload.permissions.length)} />
          <MetricCard
            icon={Eye}
            label="Assignments"
            value={String(payload.assignments.length)}
          />
          <MetricCard
            icon={ShieldAlert}
            label="Custom Roles"
            value={String(payload.roles.filter((role) => !role.isSystem).length)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Role</CardTitle>
              <CardDescription>
                Add roles like `dept_coordinator` or `external_examiner`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Department Coordinator"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (optional)</Label>
                <Input
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  placeholder="dept_coordinator"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="View-only access to project oversight."
                />
              </div>
              <Button onClick={createRole} disabled={busy || !newRoleName.trim()}>
                Create Role
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign / Revoke Role</CardTitle>
              <CardDescription>
                Attach custom roles to any user account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={assignmentUserId} onValueChange={setAssignmentUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={assignmentRoleId} onValueChange={setAssignmentRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload.roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={assignRole}
                  disabled={busy || !assignmentUserId || !assignmentRoleId}
                >
                  Assign
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(
                      {
                        action: "revoke_role",
                        userId: assignmentUserId,
                        roleId: assignmentRoleId,
                      },
                      "Role revoked."
                    )
                  }
                  disabled={busy || !assignmentUserId || !assignmentRoleId}
                >
                  Revoke
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impersonate User</CardTitle>
              <CardDescription>
                View the platform as another user for support diagnosis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Target User</Label>
                <Select
                  value={impersonateTargetUserId}
                  onValueChange={setImpersonateTargetUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload.users
                      .filter((user) => user.status === "ACTIVE")
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  value={impersonateReason}
                  onChange={(e) => setImpersonateReason(e.target.value)}
                  placeholder="Investigating support ticket #123"
                />
              </div>
              <Button
                variant="outline"
                onClick={impersonateUser}
                disabled={busy || !impersonateTargetUserId}
              >
                View As User
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Permission Matrix</CardTitle>
            <CardDescription>
              Grant or revoke role capabilities without code changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {groupedPermissions.map((group) => (
              <div key={group.category} className="space-y-3">
                <h3 className="text-sm font-semibold">{group.category}</h3>
                <div className="space-y-2">
                  {group.items.map((permission) => (
                    <div key={permission.key} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{permission.name}</p>
                      <p className="text-xs text-muted-foreground">{permission.key}</p>
                      {permission.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {permission.description}
                        </p>
                      )}
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {payload.roles.map((role) => {
                          const checked = role.permissions.includes(permission.key)
                          return (
                            <label
                              key={`${permission.key}-${role.id}`}
                              className="flex items-center justify-between rounded-md border p-2 text-sm"
                            >
                              <span className="truncate pr-2">{role.name}</span>
                              <Switch
                                checked={checked}
                                disabled={busy || (role.slug === "admin" && checked)}
                                onCheckedChange={(next) =>
                                  runAction(
                                    {
                                      action: "set_role_permission",
                                      roleId: role.id,
                                      permissionKey: permission.key,
                                      granted: next,
                                    },
                                    next
                                      ? `${permission.key} granted to ${role.name}.`
                                      : `${permission.key} revoked from ${role.name}.`
                                  )
                                }
                              />
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Role Assignments</CardTitle>
            <CardDescription>Review who currently has custom roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom assignments yet.</p>
            ) : (
              payload.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{assignment.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      Assigned by {assignment.assignedByEmail || "system"} on{" "}
                      {new Date(assignment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{assignment.roleName}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impersonation Audit Trail</CardTitle>
            <CardDescription>
              Every impersonated API action is logged here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries yet.</p>
            ) : (
              payload.auditLogs.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {entry.action}
                    {entry.resource ? ` • ${entry.resource}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Actor: {entry.actorEmail || "unknown"} ({entry.actorRole || "unknown"}) •{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}
