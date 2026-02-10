"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { StudentOverview } from "@/components/supervisor/StudentOverview"
import { PendingRequests } from "@/components/supervisor/PendingRequests"
import { ProgressAlerts } from "@/components/supervisor/ProgressAlerts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  currentSupervisor, 
  mockStudents, 
  mockProjects,
  mockMilestones,
  mockSupervisionRequests 
} from "@/lib/mock-data"
import { Users, Bell, CheckCircle2, AlertTriangle, GraduationCap, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SupervisorDashboardPage() {
  // Deterministic inactivity values per student index
  const inactivityDays = [3, 9, 1, 5, 14]

  // Get students assigned to this supervisor with their projects and milestones
  const myStudents = mockStudents
    .filter((s) => s.supervisorId === currentSupervisor.id)
    .map((student, index) => ({
      ...student,
      project: mockProjects.find((p) => p.studentId === student.id),
      milestones: mockMilestones.filter((m) => 
        mockProjects.find((p) => p.studentId === student.id)?.id === m.projectId
      ),
      lastActivity: `${inactivityDays[index % inactivityDays.length]} days ago`,
      daysInactive: inactivityDays[index % inactivityDays.length],
    }))

  // Get pending requests for this supervisor
  const pendingRequests = mockSupervisionRequests
    .filter((r) => r.supervisorId === currentSupervisor.id)
    .map((request) => ({
      ...request,
      student: mockStudents.find((s) => s.id === request.studentId),
      project: mockProjects.find((p) => p.id === request.projectId),
    }))

  // Get students with inactivity alerts (>7 days)
  const alertStudents = myStudents
    .filter((s) => s.daysInactive && s.daysInactive >= 5)
    .map((s) => ({
      student: s,
      daysInactive: s.daysInactive || 0,
      lastMilestone: "Data Collection",
      lastActivity: `${s.daysInactive} days ago`,
    }))

  const capacityPercent = Math.round((currentSupervisor.currentStudents / currentSupervisor.maxStudents) * 100)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <DashboardShell 
      user={currentSupervisor} 
      role="supervisor" 
      title="Supervisor Dashboard"
    >
      {/* Stats Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {currentSupervisor.currentStudents}/{currentSupervisor.maxStudents}
              </p>
              <p className="text-sm text-muted-foreground">Current Students</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Bell className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{currentSupervisor.pastProjects.length}</p>
              <p className="text-sm text-muted-foreground">Completed Projects</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{alertStudents.length}</p>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supervisor Profile Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            My Profile
          </CardTitle>
          <Button variant="ghost" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={currentSupervisor.avatarUrl || "/placeholder.svg"} alt={currentSupervisor.name} />
                <AvatarFallback className="bg-primary/10 text-lg text-primary">
                  {getInitials(currentSupervisor.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{currentSupervisor.name}</h3>
                <p className="text-sm text-muted-foreground">{currentSupervisor.email}</p>
                <p className="text-sm text-muted-foreground">{currentSupervisor.department}</p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Supervision Capacity</span>
                  <span className={capacityPercent >= 100 ? "font-medium text-destructive" : "font-medium"}>
                    {currentSupervisor.currentStudents}/{currentSupervisor.maxStudents}
                  </span>
                </div>
                <Progress 
                  value={capacityPercent} 
                  className="mt-1 h-2"
                />
                {capacityPercent >= 100 && (
                  <p className="mt-1 text-xs text-destructive">At full capacity</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Expertise Areas</p>
                <div className="flex flex-wrap gap-2">
                  {currentSupervisor.expertise.map((exp) => (
                    <Badge key={exp} variant="secondary">
                      {exp}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{currentSupervisor.bio}</p>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <StudentOverview 
            students={myStudents}
            onViewStudent={(id) => console.log("View student:", id)}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <PendingRequests
            requests={pendingRequests}
            onAccept={(id) => console.log("Accept request:", id)}
            onDecline={(id) => console.log("Decline request:", id)}
          />
          
          <ProgressAlerts
            alerts={alertStudents}
            onSendReminder={(id) => console.log("Send reminder to:", id)}
          />
        </div>
      </div>
    </DashboardShell>
  )
}
