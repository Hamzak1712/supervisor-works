// User roles
export type UserRole = "student" | "supervisor" | "admin"

// Base user type
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  createdAt: string
}

// Student profile
export interface StudentProfile extends User {
  role: "student"
  degree: string
  department: string
  yearOfStudy: number
  skills: string[]
  researchInterests: string[]
  availability: "full-time" | "part-time"
  supervisorId?: string
  projectId?: string
}

// Supervisor profile
export interface SupervisorProfile extends User {
  role: "supervisor"
  department: string
  expertise: string[]
  researchAreas: string[]
  maxStudents: number
  currentStudents: number
  pastProjects: string[]
  bio: string
}

// Admin profile
export interface AdminProfile extends User {
  role: "admin"
  permissions: string[]
}

// Project
export interface Project {
  id: string
  studentId: string
  title: string
  abstract: string
  description: string
  keywords: string[]
  expertiseTags: string[]
  status: "draft" | "pending_supervisor" | "active" | "completed"
  createdAt: string
  updatedAt: string
}

// Milestone
export interface Milestone {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string
  completedDate?: string
  status: "pending" | "in_progress" | "completed" | "delayed"
  isCriticalPath: boolean // PPRS, IPD, Final Viva - cannot be moved
  feedback?: string
}

// Supervision request
export interface SupervisionRequest {
  id: string
  studentId: string
  supervisorId: string
  projectId: string
  status: "pending" | "accepted" | "declined"
  matchScore: number
  matchReasons: string[]
  createdAt: string
  respondedAt?: string
}

// AI Match result
export interface SupervisorMatch {
  supervisor: SupervisorProfile
  matchScore: number
  matchReasons: string[]
  similarProjects: string[]
}

// System health (for admin)
export interface SystemHealth {
  service: string
  status: "operational" | "degraded" | "down"
  lastChecked: string
  uptime: number
}

// Activity log
export interface ActivityLog {
  id: string
  userId: string
  action: string
  description: string
  timestamp: string
}

// Statistics
export interface SystemStats {
  totalStudents: number
  totalSupervisors: number
  activeProjects: number
  pendingRequests: number
  completedProjects: number
  averageMatchScore: number
}
