"use client"

import { FileText, Tag, Clock, Pencil, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Project } from "@/types"

interface ProjectCardProps {
  project: Project | null
}

const statusConfig = {
  draft: { label: "Draft", variant: "secondary" as const, icon: FileText },
  pending_supervisor: { label: "Pending Supervisor", variant: "outline" as const, icon: Clock },
  active: { label: "Active", variant: "default" as const, icon: CheckCircle2 },
  completed: { label: "Completed", variant: "secondary" as const, icon: CheckCircle2 },
}

export function ProjectCard({ project }: ProjectCardProps) {
  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            My Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-semibold">No Project Yet</h3>
            <p className="mb-4 max-w-sm text-sm text-muted-foreground">
              Submit your project idea to get matched with the perfect supervisor.
            </p>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const status = statusConfig[project.status]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          My Project
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant} className="gap-1">
            <status.icon className="h-3 w-3" />
            {status.label}
          </Badge>
          <Button variant="ghost" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{project.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{project.abstract}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>Keywords</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Expertise Tags</p>
          <div className="flex flex-wrap gap-2">
            {project.expertiseTags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-primary/30 text-primary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Created: {project.createdAt}</span>
          <span>Updated: {project.updatedAt}</span>
        </div>
      </CardContent>
    </Card>
  )
}
