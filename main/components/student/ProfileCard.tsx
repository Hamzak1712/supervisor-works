"use client"

import { User, GraduationCap, Clock, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StudentProfile } from "@/types"

interface ProfileCardProps {
  student: StudentProfile
  compact?: boolean
}

export function ProfileCard({ student, compact = false }: ProfileCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (compact) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={student.avatarUrl || "/placeholder.svg"} alt={student.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">{student.degree}</p>
          </div>
          <Badge variant="outline" className="capitalize">
            {student.availability}
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          My Profile
        </CardTitle>
        <Button variant="ghost" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={student.avatarUrl || "/placeholder.svg"} alt={student.name} />
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {getInitials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">{student.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {student.availability}
              </Badge>
              <Badge variant="outline">Year {student.yearOfStudy}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              <span>Degree</span>
            </div>
            <p className="font-medium">{student.degree}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Department</span>
            </div>
            <p className="font-medium">{student.department}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Skills</p>
          <div className="flex flex-wrap gap-2">
            {student.skills.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Research Interests</p>
          <div className="flex flex-wrap gap-2">
            {student.researchInterests.map((interest) => (
              <Badge key={interest} variant="outline" className="border-primary/30 text-primary">
                {interest}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
