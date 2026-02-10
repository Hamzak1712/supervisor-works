"use client"

import { Sparkles, Star, Send, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { SupervisorMatch } from "@/types"

interface SupervisorMatchesProps {
  matches: SupervisorMatch[]
  onSendRequest?: (supervisorId: string) => void
}

export function SupervisorMatches({ matches, onSendRequest }: SupervisorMatchesProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getMatchColor = (score: number) => {
    if (score >= 90) return "text-success"
    if (score >= 75) return "text-primary"
    if (score >= 60) return "text-warning"
    return "text-muted-foreground"
  }

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-success"
    if (score >= 75) return "bg-primary"
    if (score >= 60) return "bg-warning"
    return "bg-muted"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Supervisor Matches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Submit your project to see AI-powered supervisor recommendations.
            </p>
          </div>
        ) : (
          matches.map((match, index) => (
            <div
              key={match.supervisor.id}
              className="rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={match.supervisor.avatarUrl || "/placeholder.svg"} alt={match.supervisor.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(match.supervisor.name)}
                      </AvatarFallback>
                    </Avatar>
                    {index === 0 && (
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground">
                        <Star className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{match.supervisor.name}</h4>
                      {index === 0 && (
                        <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                          Top Match
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{match.supervisor.department}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-lg font-bold ${getMatchColor(match.matchScore)}`}>
                        {match.matchScore}%
                      </span>
                      <span className="text-sm text-muted-foreground">match</span>
                    </div>
                    <div className="mt-1 w-32">
                      <Progress 
                        value={match.matchScore} 
                        className="h-1.5"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onSendRequest?.(match.supervisor.id)}
                  disabled={match.supervisor.currentStudents >= match.supervisor.maxStudents}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Request
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Why this match:</p>
                <ul className="space-y-1">
                  {match.matchReasons.slice(0, 2).map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {match.supervisor.expertise.slice(0, 3).map((exp) => (
                  <Badge key={exp} variant="secondary" className="text-xs">
                    {exp}
                  </Badge>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {match.supervisor.currentStudents}/{match.supervisor.maxStudents} students
                </span>
                <span>{match.similarProjects.length} similar projects</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
