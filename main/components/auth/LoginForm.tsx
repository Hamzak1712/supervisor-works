"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { UserRole } from "@/types"

// Demo credentials for each role
const demoCredentials: Record<UserRole, { email: string; password: string }> = {
  student: { email: "john.smith@university.ac.uk", password: "demo123" },
  supervisor: { email: "dr.williams@university.ac.uk", password: "demo123" },
  admin: { email: "admin@university.ac.uk", password: "demo123" },
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedDemoRole, setSelectedDemoRole] = useState<UserRole | null>(null)

  const handleDemoLogin = (role: UserRole) => {
    setSelectedDemoRole(role)
    setEmail(demoCredentials[role].email)
    setPassword(demoCredentials[role].password)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Login failed")
        setIsLoading(false)
        return
      }

      // Store JWT token and user info
      localStorage.setItem("token", data.token)
      localStorage.setItem("userRole", data.user.role.toLowerCase())
      localStorage.setItem("userEmail", data.user.email)
      localStorage.setItem("userId", data.user.id)

      const role = data.user.role.toLowerCase() as UserRole
      setIsLoading(false)
      router.push(`/dashboard/${role}`)
    } catch {
      setError("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  const handleDemoQuickLogin = (role: UserRole) => {
    // Demo mode: skip API, go straight to mock dashboard
    localStorage.setItem("userRole", role)
    localStorage.setItem("userEmail", demoCredentials[role].email)
    router.push(`/dashboard/${role}`)
  }

  return (
    <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Sign in to access your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@university.ac.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Demo Accounts
              </span>
            </div>
          </div>

          <p className="mb-2 text-center text-xs text-muted-foreground">
            Fill credentials to login via API, or skip to a demo dashboard:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={selectedDemoRole === "student" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDemoQuickLogin("student")}
              className="text-xs"
            >
              Student Demo
            </Button>
            <Button
              type="button"
              variant={selectedDemoRole === "supervisor" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDemoQuickLogin("supervisor")}
              className="text-xs"
            >
              Supervisor Demo
            </Button>
            <Button
              type="button"
              variant={selectedDemoRole === "admin" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDemoQuickLogin("admin")}
              className="text-xs"
            >
              Admin Demo
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <a
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Register here
          </a>
        </p>
      </CardFooter>
    </Card>
  )
}
