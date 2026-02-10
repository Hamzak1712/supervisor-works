import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "OK",
    service: "SupervisorMatch - AI-Powered Supervision System",
    timestamp: new Date().toISOString(),
  })
}
