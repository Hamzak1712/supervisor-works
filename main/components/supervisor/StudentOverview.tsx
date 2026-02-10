"use client"

import { Users, AlertTriangle, CheckCircle2, Clock, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import type { StudentProfile, Project, Milestone } from "@/types"

interface StudentWithProgress extends StudentProfile {
  project?: Project
  milestones?: Milestone[]
  lastActivity?: string
  daysInactive?: number
}

interface StudentOverviewProps {
  students: StudentWithProgress[]
  onViewStudent?: (studentId: string) => void
}

export function StudentOverview({ students, onViewStudent }: StudentOverviewProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getProgressPercent = (milestones?: Milestone[]) => {
    if (!milestones || milestones.length === 0) return 0
    const completed = milestones.filter((m) => m.status === "completed").length
    return Math.round((completed / milestones.length) * 100)
  }

  const getActivityStatus = (daysInactive?: number) => {
    if (!daysInactive || daysInactive <= 3) return { label: "Active", color: "bg-success" }
    if (daysInactive <= 7) return { label: "Moderate", color: "bg-warning" }
    return { label: "Inactive", color: "bg-destructive" }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          My Students ({students.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No students assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((student) => {
              const progress = getProgressPercent(student.milestones)
              const activityStatus = getActivityStatus(student.daysInactive)
              const hasAlert = student.daysInactive && student.daysInactive > 7

              return (
                <div
                  key={student.id}
                  className={`rounded-lg border p-4 transition-colors hover:border-primary/30 ${
                    hasAlert ? "border-warning/50 bg-warning/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.avatarUrl || "/placeholder.svg"} alt={student.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div 
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${activityStatus.color}`}
                          title={activityStatus.label}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold truncate">{student.name}</h4>
                          {hasAlert && (
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {student.project?.title || "No project submitted"}
                        </p>
                        <p className="text-xs text-muted-foreground">{student.degree}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewStudent?.(student.id)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {student.milestones && student.milestones.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          {student.milestones.filter((m) => m.status === "completed").length} completed
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-primary" />
                          {student.milestones.filter((m) => m.status === "in_progress").length} in progress
                        </span>
                        {student.milestones.filter((m) => m.status === "delayed").length > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {student.milestones.filter((m) => m.status === "delayed").length} delayed
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {hasAlert && (
                    <div className="mt-3 rounded bg-warning/10 px-3 py-2 text-xs text-warning">
                      No activity for {student.daysInactive} days - consider reaching out
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
