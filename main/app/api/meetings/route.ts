import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

function resolveDisplayName(person: {
  email: string
  studentProfile: { fullName: string | null } | null
  supervisorProfile: { fullName: string | null } | null
}) {
  return (
    person.studentProfile?.fullName ||
    person.supervisorProfile?.fullName ||
    person.email.split("@")[0] ||
    "User"
  )
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const otherUserId = url.searchParams.get("userId")?.trim()

    const meetings = await prisma.meeting.findMany({
      where: otherUserId
        ? {
            OR: [
              {
                organizerId: payload.sub,
                attendeeId: otherUserId,
              },
              {
                organizerId: otherUserId,
                attendeeId: payload.sub,
              },
            ],
          }
        : {
            OR: [
              { organizerId: payload.sub },
              { attendeeId: payload.sub },
            ],
          },
      orderBy: {
        scheduledAt: "asc",
      },
      select: {
        id: true,
        organizerId: true,
        attendeeId: true,
        title: true,
        description: true,
        scheduledAt: true,
        createdAt: true,
        organizer: {
          select: {
            id: true,
            email: true,
            studentProfile: {
              select: { fullName: true },
            },
            supervisorProfile: {
              select: { fullName: true },
            },
          },
        },
        attendee: {
          select: {
            id: true,
            email: true,
            studentProfile: {
              select: { fullName: true },
            },
            supervisorProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    })

    const normalizedMeetings = meetings.map((meeting) => ({
      id: meeting.id,
      organizerId: meeting.organizerId,
      attendeeId: meeting.attendeeId,
      title: meeting.title,
      description: meeting.description,
      scheduledAt: meeting.scheduledAt,
      createdAt: meeting.createdAt,
      organizer: {
        id: meeting.organizer.id,
        email: meeting.organizer.email,
        name: resolveDisplayName(meeting.organizer),
      },
      attendee: {
        id: meeting.attendee.id,
        email: meeting.attendee.email,
        name: resolveDisplayName(meeting.attendee),
      },
    }))

    return NextResponse.json({ meetings: normalizedMeetings }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const attendeeId =
      typeof body.attendeeId === "string" ? body.attendeeId.trim() : ""
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const description =
      typeof body.description === "string" ? body.description.trim() : null
    const scheduledAt =
      typeof body.scheduledAt === "string" ? body.scheduledAt.trim() : ""

    if (!attendeeId) {
      return NextResponse.json(
        { error: "attendeeId is required" },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: "Meeting title is required" },
        { status: 400 }
      )
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "Meeting time is required" },
        { status: 400 }
      )
    }

    const meeting = await prisma.meeting.create({
      data: {
        organizerId: payload.sub,
        attendeeId,
        title,
        description,
        scheduledAt: new Date(scheduledAt),
      },
      select: {
        id: true,
        organizerId: true,
        attendeeId: true,
        title: true,
        description: true,
        scheduledAt: true,
        createdAt: true,
        organizer: {
          select: {
            id: true,
            email: true,
            studentProfile: {
              select: { fullName: true },
            },
            supervisorProfile: {
              select: { fullName: true },
            },
          },
        },
        attendee: {
          select: {
            id: true,
            email: true,
            studentProfile: {
              select: { fullName: true },
            },
            supervisorProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    })

    await prisma.notification.create({
      data: {
        userId: attendeeId,
        title: "New meeting scheduled",
        body: `A meeting titled "${title}" has been scheduled with you.`,
        type: "meeting",
      },
    })

    return NextResponse.json(
      {
        meeting: {
          id: meeting.id,
          organizerId: meeting.organizerId,
          attendeeId: meeting.attendeeId,
          title: meeting.title,
          description: meeting.description,
          scheduledAt: meeting.scheduledAt,
          createdAt: meeting.createdAt,
          organizer: {
            id: meeting.organizer.id,
            email: meeting.organizer.email,
            name: resolveDisplayName(meeting.organizer),
          },
          attendee: {
            id: meeting.attendee.id,
            email: meeting.attendee.email,
            name: resolveDisplayName(meeting.attendee),
          },
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
