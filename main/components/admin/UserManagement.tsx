"use client"

import { useState } from "react"
import { Search, UserCog, MoreHorizontal, Shield, GraduationCap, Users, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User, UserRole } from "@/types"

interface UserManagementProps {
  users: User[]
  onRoleChange?: (userId: string, newRole: UserRole) => void
  onDeleteUser?: (userId: string) => void
}

const roleConfig: Record<UserRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "bg-destructive/10 text-destructive" },
  supervisor: { label: "Supervisor", icon: GraduationCap, color: "bg-primary/10 text-primary" },
  student: { label: "Student", icon: Users, color: "bg-success/10 text-success" },
}

export function UserManagement({ users, onRoleChange, onDeleteUser }: UserManagementProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const userCounts = {
    all: users.length,
    student: users.filter((u) => u.role === "student").length,
    supervisor: users.filter((u) => u.role === "supervisor").length,
    admin: users.filter((u) => u.role === "admin").length,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          User Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as UserRole | "all")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles ({userCounts.all})</SelectItem>
              <SelectItem value="student">Students ({userCounts.student})</SelectItem>
              <SelectItem value="supervisor">Supervisors ({userCounts.supervisor})</SelectItem>
              <SelectItem value="admin">Admins ({userCounts.admin})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Role Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(["student", "supervisor", "admin"] as UserRole[]).map((role) => {
            const config = roleConfig[role]
            const Icon = config.icon
            return (
              <div
                key={role}
                className={`rounded-lg p-3 text-center ${config.color}`}
              >
                <Icon className="mx-auto mb-1 h-5 w-5" />
                <p className="text-lg font-bold">{userCounts[role]}</p>
                <p className="text-xs">{config.label}s</p>
              </div>
            )
          })}
        </div>

        {/* User List */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No users found.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const config = roleConfig[user.role]
              const Icon = config.icon

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>

                  <Badge variant="secondary" className={`gap-1 ${config.color}`}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onRoleChange?.(user.id, "student")}>
                        <Users className="mr-2 h-4 w-4" />
                        Set as Student
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRoleChange?.(user.id, "supervisor")}>
                        <GraduationCap className="mr-2 h-4 w-4" />
                        Set as Supervisor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRoleChange?.(user.id, "admin")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Set as Admin
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDeleteUser?.(user.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </CardContent>
    </Card>
  )
}
