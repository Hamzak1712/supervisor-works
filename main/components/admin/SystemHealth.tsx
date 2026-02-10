"use client"

import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { SystemHealth as SystemHealthType } from "@/types"

interface SystemHealthProps {
  services: SystemHealthType[]
  onRefresh?: () => void
}

const statusConfig = {
  operational: { 
    label: "Operational", 
    icon: CheckCircle2, 
    color: "text-success",
    bg: "bg-success/10"
  },
  degraded: { 
    label: "Degraded", 
    icon: AlertTriangle, 
    color: "text-warning",
    bg: "bg-warning/10"
  },
  down: { 
    label: "Down", 
    icon: XCircle, 
    color: "text-destructive",
    bg: "bg-destructive/10"
  },
}

export function SystemHealth({ services, onRefresh }: SystemHealthProps) {
  const operationalCount = services.filter((s) => s.status === "operational").length
  const overallHealth = Math.round((operationalCount / services.length) * 100)

  const formatLastChecked = (dateStr: string) => {
    const date = new Date(dateStr)
    const hours = String(date.getUTCHours()).padStart(2, "0")
    const minutes = String(date.getUTCMinutes()).padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          System Health
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Overall Health */}
        <div className="mb-6 rounded-lg bg-secondary/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall System Health</p>
              <p className={`text-3xl font-bold ${overallHealth === 100 ? "text-success" : overallHealth >= 80 ? "text-warning" : "text-destructive"}`}>
                {overallHealth}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              {overallHealth === 100 ? (
                <CheckCircle2 className="h-10 w-10 text-success" />
              ) : overallHealth >= 80 ? (
                <AlertTriangle className="h-10 w-10 text-warning" />
              ) : (
                <XCircle className="h-10 w-10 text-destructive" />
              )}
            </div>
          </div>
          <Progress 
            value={overallHealth} 
            className="mt-3 h-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {operationalCount}/{services.length} services operational
          </p>
        </div>

        {/* Service List */}
        <div className="space-y-3">
          {services.map((service) => {
            const config = statusConfig[service.status]
            const StatusIcon = config.icon

            return (
              <div
                key={service.service}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  service.status !== "operational" ? config.bg : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <StatusIcon className={`h-5 w-5 ${config.color}`} />
                  <div>
                    <p className="font-medium">{service.service}</p>
                    <p className="text-xs text-muted-foreground">
                      Last checked: {formatLastChecked(service.lastChecked)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                  <p className="text-xs text-muted-foreground">{service.uptime}% uptime</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
