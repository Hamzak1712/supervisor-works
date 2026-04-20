"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User as UserType } from "@/types"

interface HeaderProps {
  user: UserType
  title?: string
}

export function Header({ user, title }: HeaderProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchUnreadCount() {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          if (!cancelled) setUnreadCount(0)
          return
        }

        const res = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) return

        const data = await res.json()
        const nextUnreadCount =
          typeof data?.unreadCount === "number"
            ? data.unreadCount
            : Array.isArray(data?.notifications)
              ? data.notifications.filter((n: { read: boolean }) => !n.read)
                  .length
              : 0

        if (!cancelled) {
          setUnreadCount(nextUnreadCount)
        }
      } catch (err) {
        console.error(err)
      }
    }

    function handleNotificationsUpdated() {
      void fetchUnreadCount()
    }

    void fetchUnreadCount()

    const interval = window.setInterval(() => {
      void fetchUnreadCount()
    }, 30000)

    window.addEventListener("focus", handleNotificationsUpdated)
    window.addEventListener("notifications:updated", handleNotificationsUpdated)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", handleNotificationsUpdated)
      window.removeEventListener(
        "notifications:updated",
        handleNotificationsUpdated
      )
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userEmail")
    router.push("/login")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-xl font-semibold">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 bg-secondary/50 pl-9"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href="/dashboard/notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`/dashboard/${user.role}/profile`} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
