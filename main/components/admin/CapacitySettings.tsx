"use client"

import { useState } from "react"
import { Settings, Users, Save, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { SupervisorProfile } from "@/types"

interface CapacitySettingsProps {
  supervisors: SupervisorProfile[]
  onUpdateCapacity?: (supervisorId: string, newCapacity: number) => void
}

export function CapacitySettings({ supervisors, onUpdateCapacity }: CapacitySettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tempCapacity, setTempCapacity] = useState<number>(0)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleEdit = (supervisor: SupervisorProfile) => {
    setEditingId(supervisor.id)
    setTempCapacity(supervisor.maxStudents)
  }

  const handleSave = (supervisorId: string) => {
    onUpdateCapacity?.(supervisorId, tempCapacity)
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setTempCapacity(0)
  }

  const totalCapacity = supervisors.reduce((sum, s) => sum + s.maxStudents, 0)
  const totalAssigned = supervisors.reduce((sum, s) => sum + s.currentStudents, 0)
  const fullSupervisors = supervisors.filter((s) => s.currentStudents >= s.maxStudents).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Supervisor Capacity Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <p className="text-2xl font-bold">{totalAssigned}/{totalCapacity}</p>
            <p className="text-xs text-muted-foreground">Total Assigned</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <p className="text-2xl font-bold">{totalCapacity - totalAssigned}</p>
            <p className="text-xs text-muted-foreground">Available Slots</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${fullSupervisors > 0 ? "bg-warning/10" : "bg-success/10"}`}>
            <p className="text-2xl font-bold">{fullSupervisors}</p>
            <p className="text-xs text-muted-foreground">At Full Capacity</p>
          </div>
        </div>

        {/* Supervisor List */}
        <div className="space-y-3">
          {supervisors.map((supervisor) => {
            const isEditing = editingId === supervisor.id
            const capacityPercent = Math.round((supervisor.currentStudents / supervisor.maxStudents) * 100)
            const isAtCapacity = supervisor.currentStudents >= supervisor.maxStudents

            return (
              <div
                key={supervisor.id}
                className={`rounded-lg border p-4 ${isAtCapacity ? "border-warning/50 bg-warning/5" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={supervisor.avatarUrl || "/placeholder.svg"} alt={supervisor.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(supervisor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{supervisor.name}</h4>
                        {isAtCapacity && (
                          <Badge variant="outline" className="border-warning text-warning">
                            Full
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{supervisor.department}</p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={supervisor.currentStudents}
                        max={20}
                        value={tempCapacity}
                        onChange={(e) => setTempCapacity(parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Button size="sm" onClick={() => handleSave(supervisor.id)}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(supervisor)}
                    >
                      Edit Limit
                    </Button>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Students
                    </span>
                    <span className={isAtCapacity ? "font-medium text-warning" : "font-medium"}>
                      {supervisor.currentStudents} / {supervisor.maxStudents}
                    </span>
                  </div>
                  <Progress 
                    value={capacityPercent} 
                    className="h-2"
                  />
                </div>

                {isAtCapacity && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    <span>This supervisor will not appear in AI recommendations</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
