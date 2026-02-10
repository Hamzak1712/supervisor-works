"use client"

import { useState } from "react"
import { Calendar, Lock, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Milestone } from "@/types"

interface GanttChartProps {
  milestones: Milestone[]
  onUpdateStatus?: (milestoneId: string, status: Milestone["status"]) => void
}

const statusConfig = {
  pending: { 
    label: "Pending", 
    color: "bg-muted text-muted-foreground",
    barColor: "bg-muted",
    icon: Clock 
  },
  in_progress: { 
    label: "In Progress", 
    color: "bg-primary/10 text-primary",
    barColor: "bg-primary",
    icon: Clock 
  },
  completed: { 
    label: "Completed", 
    color: "bg-success/10 text-success",
    barColor: "bg-success",
    icon: CheckCircle2 
  },
  delayed: { 
    label: "Delayed", 
    color: "bg-destructive/10 text-destructive",
    barColor: "bg-destructive",
    icon: AlertTriangle 
  },
}

export function GanttChart({ milestones, onUpdateStatus }: GanttChartProps) {
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)

  // Calculate date range
  const dates = milestones.map((m) => new Date(m.dueDate))
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  const getPositionPercent = (dateStr: string) => {
    const date = new Date(dateStr)
    const daysDiff = Math.ceil((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
    return (daysDiff / totalDays) * 100
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  }

  // Use a fixed "today" for SSR/client consistency
  const todayStr = "2025-01-20"
  const todayPercent = getPositionPercent(todayStr)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline Header */}
        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatDate(minDate.toISOString())}</span>
          <span>{formatDate(maxDate.toISOString())}</span>
        </div>

        {/* Timeline Bar */}
        <div className="relative mb-6 h-2 rounded-full bg-secondary">
          {/* Today marker */}
          {todayPercent >= 0 && todayPercent <= 100 && (
            <div
              className="absolute top-1/2 z-10 h-4 w-0.5 -translate-y-1/2 bg-chart-2"
              style={{ left: `${todayPercent}%` }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-chart-2">
                Today
              </span>
            </div>
          )}
          
          {/* Milestone markers */}
          {milestones.map((milestone) => {
            const status = statusConfig[milestone.status]
            const position = getPositionPercent(milestone.dueDate)
            return (
              <div
                key={milestone.id}
                className={cn(
                  "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-background transition-transform hover:scale-125",
                  status.barColor,
                  milestone.isCriticalPath && "ring-2 ring-warning ring-offset-2 ring-offset-background"
                )}
                style={{ left: `${position}%` }}
                onClick={() => setExpandedMilestone(expandedMilestone === milestone.id ? null : milestone.id)}
                title={milestone.title}
              />
            )
          })}
        </div>

        {/* Milestone List */}
        <div className="space-y-2">
          {milestones.map((milestone) => {
            const status = statusConfig[milestone.status]
            const StatusIcon = status.icon
            const isExpanded = expandedMilestone === milestone.id

            return (
              <div
                key={milestone.id}
                className={cn(
                  "rounded-lg border transition-colors",
                  isExpanded ? "border-primary/50 bg-primary/5" : "border-border"
                )}
              >
                <button
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setExpandedMilestone(isExpanded ? null : milestone.id)}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", status.color)}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{milestone.title}</span>
                      {milestone.isCriticalPath && (
                        <Lock className="h-3 w-3 text-warning shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Due: {formatDate(milestone.dueDate)}
                    </p>
                  </div>
                  <Badge variant="secondary" className={status.color}>
                    {status.label}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 py-3">
                    <p className="mb-3 text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                    {milestone.isCriticalPath && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                        <Lock className="h-4 w-4" />
                        <span>This is a university deadline and cannot be moved.</span>
                      </div>
                    )}
                    {milestone.feedback && (
                      <div className="mb-3 rounded-lg bg-secondary p-3">
                        <p className="text-xs font-medium text-muted-foreground">Supervisor Feedback:</p>
                        <p className="mt-1 text-sm">{milestone.feedback}</p>
                      </div>
                    )}
                    {!milestone.isCriticalPath && milestone.status !== "completed" && (
                      <div className="flex gap-2">
                        {milestone.status !== "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateStatus?.(milestone.id, "in_progress")}
                          >
                            Start Working
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus?.(milestone.id, "completed")}
                        >
                          Mark Complete
                        </Button>
                        {milestone.status !== "delayed" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onUpdateStatus?.(milestone.id, "delayed")}
                          >
                            Report Delay
                          </Button>
                        )}
                      </div>
                    )}
                    {milestone.completedDate && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Completed: {formatDate(milestone.completedDate)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-muted" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span>Delayed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-warning" />
            <span>Critical Path (Locked)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
