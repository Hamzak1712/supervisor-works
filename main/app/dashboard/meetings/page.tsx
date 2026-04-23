import { Suspense } from "react"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import type { User } from "@/types"

import MeetingsPageClient from "./MeetingsPageClient"

const fallbackUser: User = {
  id: "user",
  email: "user@example.com",
  name: "User",
  role: "student",
  createdAt: new Date(0).toISOString(),
}

export default function MeetingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell user={fallbackUser} role="student" title="Meetings">
          <div className="p-6 text-sm text-muted-foreground">Loading meetings...</div>
        </DashboardShell>
      }
    >
      <MeetingsPageClient />
    </Suspense>
  )
}
