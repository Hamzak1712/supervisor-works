"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Sparkles,
  Info,
  ExternalLink,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { User, UserRole } from "@/types"

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
}

type ApiMeUser = {
  id: string
  email: string
  role: string
  createdAt: string
  studentProfile?: {
    fullName?: string | null
  } | null
  supervisorProfile?: {
    fullName?: string | null
  } | null
}

const fallbackUser: User = {
  id: "user",
  email: "user@example.com",
  name: "User",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeRole(role: string | null | undefined): UserRole {
  const value = (role || "").toLowerCase()
  if (value === "supervisor") return "supervisor"
  if (value === "admin") return "admin"
  return "student"
}

function resolveNotificationHref(type: string, role: UserRole) {
  switch (type) {
    case "message":
      return "/dashboard/messages"
    case "meeting":
      return "/dashboard/meetings"
    case "milestone_feedback":
      return role === "supervisor"
        ? "/dashboard/supervisor/feedback"
        : "/dashboard/student/project-timeline"
    case "request_update":
      return role === "supervisor"
        ? "/dashboard/supervisor/requests"
        : "/dashboard/student/find-supervisor"
    default:
      return "/dashboard/notifications"
  }
}

function getNotificationMeta(type: string) {
  switch (type) {
    case "message":
      return {
        icon: MessageSquare,
        label: "Message",
        tone: "border-sky-300/60 bg-sky-500/5",
        badgeTone: "border-sky-300/60 bg-sky-500/10 text-sky-700",
      }
    case "meeting":
      return {
        icon: Calendar,
        label: "Meeting",
        tone: "border-violet-300/60 bg-violet-500/5",
        badgeTone: "border-violet-300/60 bg-violet-500/10 text-violet-700",
      }
    case "milestone_feedback":
      return {
        icon: CheckCircle2,
        label: "Feedback",
        tone: "border-emerald-300/60 bg-emerald-500/5",
        badgeTone: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700",
      }
    case "request_update":
      return {
        icon: Sparkles,
        label: "Request",
        tone: "border-amber-300/60 bg-amber-500/5",
        badgeTone: "border-amber-300/60 bg-amber-500/10 text-amber-700",
      }
    default:
      return {
        icon: Info,
        label: "General",
        tone: "border-border bg-muted/20",
        badgeTone: "border-border bg-muted/40 text-muted-foreground",
      }
  }
}

function notifyNotificationUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("notifications:updated"))
  }
}

export default function NotificationsPage() {
  const router = useRouter()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [workingId, setWorkingId] = useState("")
  const [markingAll, setMarkingAll] = useState(false)
  const [currentRole, setCurrentRole] = useState<UserRole>("student")
  const [shellUser, setShellUser] = useState<User>(fallbackUser)

  useEffect(() => {
    async function fetchNotifications() {
      try {
        setError("")
        const token = localStorage.getItem("token")
        const storedRole = normalizeRole(
          localStorage.getItem("userRole") || localStorage.getItem("role")
        )
        const storedEmail = localStorage.getItem("userEmail") || fallbackUser.email

        setCurrentRole(storedRole)
        setShellUser({
          ...fallbackUser,
          email: storedEmail,
          role: storedRole,
          name: storedRole === "supervisor" ? "Supervisor" : "Student",
        })

        const [notificationsRes, meRes] = await Promise.all([
          fetch("/api/notifications", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        const notificationsData = await notificationsRes.json()
        const meData = await meRes.json()

        if (!notificationsRes.ok) {
          throw new Error(notificationsData?.error || "Failed to load notifications")
        }

        setNotifications(notificationsData.notifications || [])

        if (meRes.ok && meData?.user) {
          const meUser = meData.user as ApiMeUser
          const normalizedRole = normalizeRole(meUser.role)
          const fullName =
            meUser.studentProfile?.fullName ||
            meUser.supervisorProfile?.fullName ||
            meUser.email?.split("@")[0] ||
            "User"

          setCurrentRole(normalizedRole)
          setShellUser({
            id: meUser.id || fallbackUser.id,
            email: meUser.email || fallbackUser.email,
            name: fullName,
            role: normalizedRole,
            createdAt:
              typeof meUser.createdAt === "string"
                ? meUser.createdAt
                : fallbackUser.createdAt,
            avatarUrl: "/placeholder.svg",
          })
        }
      } catch (err: any) {
        console.error(err)
        setError(err?.message || "Could not load notifications.")
      } finally {
        setLoading(false)
      }
    }

    void fetchNotifications()
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )

  async function markAsRead(notificationId: string, suppressError = false) {
    try {
      if (!suppressError) setError("")
      setWorkingId(notificationId)
      const token = localStorage.getItem("token")

      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notificationId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update notification")
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item
        )
      )
      notifyNotificationUpdate()
    } catch (err: any) {
      console.error(err)
      if (!suppressError) {
        setError(err?.message || "Could not update notification.")
      }
    } finally {
      setWorkingId("")
    }
  }

  async function markAllRead() {
    try {
      setError("")
      setMarkingAll(true)
      const token = localStorage.getItem("token")

      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          markAll: true,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update notifications")
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
      notifyNotificationUpdate()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Could not update notifications.")
    } finally {
      setMarkingAll(false)
    }
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.read) {
      await markAsRead(notification.id, true)
    }
    router.push(resolveNotificationHref(notification.type, currentRole))
  }

  return (
    <DashboardShell user={shellUser} role={currentRole} title="Notifications">
      <div className="space-y-6">
        {error && (
          <Card className="border-red-500/30">
            <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{unreadCount} unread</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                disabled={markingAll || unreadCount === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {markingAll ? "Marking..." : "Mark all read"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const meta = getNotificationMeta(notification.type)
                  const Icon = meta.icon
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        notification.read
                          ? "border-border bg-background opacity-80"
                          : meta.tone
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div className="rounded-full bg-muted p-2">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{notification.title}</p>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", meta.badgeTone)}
                              >
                                {meta.label}
                              </Badge>
                              {!notification.read && (
                                <Badge variant="secondary" className="text-[10px]">
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.body}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openNotification(notification)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => markAsRead(notification.id)}
                              disabled={workingId === notification.id}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {workingId === notification.id ? "Saving..." : "Mark read"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
