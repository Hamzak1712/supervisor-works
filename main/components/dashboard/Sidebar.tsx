"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  GraduationCap,
  LayoutDashboard,
  User,
  FileText,
  Users,
  Sparkles,
  Calendar,
  Bell,
  Settings,
  Shield,
  Activity,
  Database,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/types"

interface SidebarProps {
  role: UserRole
  collapsed: boolean
  onToggle: () => void
}

const studentNavItems = [
  { href: "/dashboard/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/student/profile", label: "My Profile", icon: User },
  { href: "/dashboard/student/project", label: "My Project", icon: FileText },
  { href: "/dashboard/student/matching", label: "Find Supervisor", icon: Sparkles },
  { href: "/dashboard/student/timeline", label: "Project Timeline", icon: Calendar },
  { href: "/dashboard/student/notifications", label: "Notifications", icon: Bell },
]

const supervisorNavItems = [
  { href: "/dashboard/supervisor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/supervisor/profile", label: "My Profile", icon: User },
  { href: "/dashboard/supervisor/students", label: "My Students", icon: Users },
  { href: "/dashboard/supervisor/requests", label: "Requests", icon: Bell },
  { href: "/dashboard/supervisor/settings", label: "Settings", icon: Settings },
]

const adminNavItems = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/users", label: "User Management", icon: UserCog },
  { href: "/dashboard/admin/supervisors", label: "Supervisors", icon: Users },
  { href: "/dashboard/admin/system", label: "System Health", icon: Activity },
  { href: "/dashboard/admin/data", label: "Data Management", icon: Database },
  { href: "/dashboard/admin/settings", label: "Settings", icon: Shield },
]

const navItemsByRole: Record<UserRole, typeof studentNavItems> = {
  student: studentNavItems,
  supervisor: supervisorNavItems,
  admin: adminNavItems,
}

export function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const navItems = navItemsByRole[role]

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/10">
              <GraduationCap className="h-5 w-5 text-sidebar-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground">SupervisorMatch</span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/10">
            <GraduationCap className="h-5 w-5 text-sidebar-primary" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Role Badge */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <p className="text-xs text-sidebar-foreground/60">Logged in as</p>
            <p className="text-sm font-medium capitalize text-sidebar-foreground">{role}</p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-sm hover:bg-sidebar-accent"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  )
}
