"use client"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { ProfileCard } from "@/components/student/ProfileCard"
import { ProjectCard } from "@/components/student/ProjectCard"
import { SupervisorMatches } from "@/components/student/SupervisorMatches"
import { GanttChart } from "@/components/student/GanttChart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  currentStudent, 
  mockProjects, 
  mockMilestones, 
  mockSupervisorMatches,
  mockSupervisors 
} from "@/lib/mock-data"
import { CheckCircle2, Clock, Calendar, Users } from "lucide-react"

export default function StudentDashboardPage() {
  const project = mockProjects.find((p) => p.studentId === currentStudent.id)
  const supervisor = currentStudent.supervisorId 
    ? mockSupervisors.find((s) => s.id === currentStudent.supervisorId)
    : null

  // Calculate progress
  const completedMilestones = mockMilestones.filter((m) => m.status === "completed").length
  const totalMilestones = mockMilestones.length
  const progressPercent = Math.round((completedMilestones / totalMilestones) * 100)

  return (
    <DashboardShell 
      user={currentStudent} 
      role="student" 
      title="Student Dashboard"
    >
      {/* Stats Overview */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{progressPercent}%</p>
              <p className="text-sm text-muted-foreground">Project Progress</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <Clock className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedMilestones}/{totalMilestones}</p>
              <p className="text-sm text-muted-foreground">Milestones Done</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Calendar className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">Mar 15</p>
              <p className="text-sm text-muted-foreground">Next Deadline</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
              <Users className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold truncate">
                {supervisor ? supervisor.name.split(" ").slice(0, 2).join(" ") : "None"}
              </p>
              <p className="text-sm text-muted-foreground">Supervisor</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supervisor Info Banner */}
      {supervisor && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Your Supervisor: {supervisor.name}</p>
                <p className="text-sm text-muted-foreground">{supervisor.department}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Active Supervision
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <ProfileCard student={currentStudent} />
          <ProjectCard project={project || null} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {!supervisor && (
            <SupervisorMatches 
              matches={mockSupervisorMatches} 
              onSendRequest={(id) => console.log("Request sent to:", id)}
            />
          )}
          
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Project Completion</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <p className="text-2xl font-bold text-success">{completedMilestones}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">{totalMilestones - completedMilestones}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Width Gantt Chart */}
      <div className="mt-6">
        <GanttChart 
          milestones={mockMilestones}
          onUpdateStatus={(id, status) => console.log("Update milestone:", id, status)}
        />
      </div>
    </DashboardShell>
  )
}
