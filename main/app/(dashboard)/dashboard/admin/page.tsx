"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { UserManagement } from "@/components/admin/UserManagement"
import { SystemHealth } from "@/components/admin/SystemHealth"
import { CapacitySettings } from "@/components/admin/CapacitySettings"
import { Card, CardContent } from "@/components/ui/card"
import { 
  currentAdmin,
  mockStudents, 
  mockSupervisors,
  mockSystemHealth 
} from "@/lib/mock-data"
import { Users, GraduationCap, Shield, Activity, FileText, AlertTriangle } from "lucide-react"
import type { User } from "@/types"

export default function AdminDashboardPage() {
  // Combine all users for management
  const allUsers: User[] = [
    ...mockStudents.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      avatarUrl: s.avatarUrl,
      createdAt: s.createdAt,
    })),
    ...mockSupervisors.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      avatarUrl: s.avatarUrl,
      createdAt: s.createdAt,
    })),
    {
      id: currentAdmin.id,
      email: currentAdmin.email,
      name: currentAdmin.name,
      role: currentAdmin.role,
      avatarUrl: currentAdmin.avatarUrl,
      createdAt: currentAdmin.createdAt,
    },
  ]

  const studentCount = mockStudents.length
  const supervisorCount = mockSupervisors.length
  const totalProjects = mockStudents.filter((s) => s.supervisorId).length
  const operationalServices = mockSystemHealth.filter((s) => s.status === "operational").length
  const totalServices = mockSystemHealth.length
  const fullCapacitySupervisors = mockSupervisors.filter(
    (s) => s.currentStudents >= s.maxStudents
  ).length

  return (
    <DashboardShell 
      user={currentAdmin} 
      role="admin" 
      title="Admin Dashboard"
    >
      {/* Stats Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentCount}</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
              <GraduationCap className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold">{supervisorCount}</p>
              <p className="text-sm text-muted-foreground">Supervisors</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <FileText className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProjects}</p>
              <p className="text-sm text-muted-foreground">Active Projects</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">1</p>
              <p className="text-sm text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${operationalServices === totalServices ? "bg-success/10" : "bg-warning/10"}`}>
              <Activity className={`h-6 w-6 ${operationalServices === totalServices ? "text-success" : "text-warning"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{operationalServices}/{totalServices}</p>
              <p className="text-sm text-muted-foreground">Services OK</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${fullCapacitySupervisors > 0 ? "bg-warning/10" : "bg-success/10"}`}>
              <AlertTriangle className={`h-6 w-6 ${fullCapacitySupervisors > 0 ? "text-warning" : "text-success"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{fullCapacitySupervisors}</p>
              <p className="text-sm text-muted-foreground">At Capacity</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <UserManagement 
            users={allUsers}
            onRoleChange={(id, role) => console.log("Change role:", id, role)}
            onDeleteUser={(id) => console.log("Delete user:", id)}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <SystemHealth 
            services={mockSystemHealth}
            onRefresh={() => console.log("Refresh health")}
          />
          
          <CapacitySettings
            supervisors={mockSupervisors}
            onUpdateCapacity={(id, capacity) => console.log("Update capacity:", id, capacity)}
          />
        </div>
      </div>
    </DashboardShell>
  )
}
