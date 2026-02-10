"use client"

import { AlertTriangle, Clock, CheckCircle2, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { StudentProfile } from "@/types"

interface AlertStudent {
  student: StudentProfile
  daysInactive: number
  lastMilestone?: string
  lastActivity: string
}

interface ProgressAlertsProps {
  alerts: AlertStudent[]
  onSendReminder?: (studentId: string) => void
}

export function ProgressAlerts({ alerts, onSendReminder }: ProgressAlertsProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getSeverity = (days: number) => {
    if (days >= 14) return { level: "critical", color: "text-destructive", bg: "bg-destructive/10" }
    if (days >= 7) return { level: "warning", color: "text-warning", bg: "bg-warning/10" }
    return { level: "moderate", color: "text-muted-foreground", bg: "bg-muted" }
  }

  const sortedAlerts = [...alerts].sort((a, b) => b.daysInactive - a.daysInactive)
  const criticalAlerts = sortedAlerts.filter((a) => a.daysInactive >= 7)

  return (
    <Card className={criticalAlerts.length > 0 ? "border-warning/50" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${criticalAlerts.length > 0 ? "text-warning" : "text-muted-foreground"}`} />
          Progress Alerts
          {criticalAlerts.length > 0 && (
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-xs text-warning-foreground">
              {criticalAlerts.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
            <p className="font-medium text-success">All students are on track!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No inactivity alerts at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => {
              const severity = getSeverity(alert.daysInactive)
              
              return (
                <div
                  key={alert.student.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${severity.bg}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={alert.student.avatarUrl || "/placeholder.svg"} alt={alert.student.name} />
                    <AvatarFallback className="bg-background">
                      {getInitials(alert.student.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{alert.student.name}</h4>
                      <Clock className={`h-4 w-4 ${severity.color}`} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last active: {alert.lastActivity}
                    </p>
                    {alert.lastMilestone && (
                      <p className="text-xs text-muted-foreground">
                        Last milestone: {alert.lastMilestone}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`text-right ${severity.color}`}>
                      <p className="text-lg font-bold">{alert.daysInactive}</p>
                      <p className="text-xs">days</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSendReminder?.(alert.student.id)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
