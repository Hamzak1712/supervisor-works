"use client"

import { Bell, CheckCircle, XCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { SupervisionRequest, StudentProfile, Project } from "@/types"

interface RequestWithDetails extends SupervisionRequest {
  student?: StudentProfile
  project?: Project
}

interface PendingRequestsProps {
  requests: RequestWithDetails[]
  onAccept?: (requestId: string) => void
  onDecline?: (requestId: string) => void
}

export function PendingRequests({ requests, onAccept, onDecline }: PendingRequestsProps) {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const pendingRequests = requests.filter((r) => r.status === "pending")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Pending Requests
          {pendingRequests.length > 0 && (
            <Badge variant="default" className="ml-2">
              {pendingRequests.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No pending supervision requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const isExpanded = expandedRequest === request.id
              
              return (
                <div
                  key={request.id}
                  className="rounded-lg border border-border bg-card/50 transition-colors hover:border-primary/30"
                >
                  <button
                    className="flex w-full items-center gap-3 p-4 text-left"
                    onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={request.student?.avatarUrl || "/placeholder.svg"} alt={request.student?.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {request.student ? getInitials(request.student.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{request.student?.name}</h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {request.project?.title || "Project request"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="font-bold text-primary">{request.matchScore}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">match</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4">
                      {/* Match Score Visual */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Match Score</span>
                          <span className="font-medium">{request.matchScore}%</span>
                        </div>
                        <Progress value={request.matchScore} className="mt-1 h-2" />
                      </div>

                      {/* Match Reasons */}
                      <div className="mb-4">
                        <p className="mb-2 text-sm font-medium">Why this match:</p>
                        <ul className="space-y-1">
                          {request.matchReasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Student Info */}
                      {request.student && (
                        <div className="mb-4 rounded-lg bg-secondary/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Student Details</p>
                          <p className="mt-1 text-sm">{request.student.degree}</p>
                          <p className="text-sm text-muted-foreground">{request.student.department}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {request.student.skills.slice(0, 4).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Project Abstract */}
                      {request.project && (
                        <div className="mb-4">
                          <p className="text-sm font-medium">{request.project.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                            {request.project.abstract}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => onAccept?.(request.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => onDecline?.(request.id)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                      </div>

                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Received {request.createdAt}
                      </p>
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
