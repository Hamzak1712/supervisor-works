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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ meetingId: string }> }
) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { meetingId } = await context.params
    const targetMeetingId = (meetingId || "").trim()

    if (!targetMeetingId) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }

    const existing = await prisma.meeting.findUnique({
      where: { id: targetMeetingId },
      select: {
        id: true,
        organizerId: true,
        attendeeId: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
    }

    if (existing.organizerId !== payload.sub) {
      return NextResponse.json(
        { error: "Only the meeting organizer can edit this meeting" },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : undefined
    const description =
      typeof body.description === "string" ? body.description.trim() : undefined
    const scheduledAt =
      typeof body.scheduledAt === "string" ? body.scheduledAt.trim() : undefined

    const data: {
      title?: string
      description?: string | null
      scheduledAt?: Date
    } = {}

    if (title !== undefined) {
      if (!title) {
        return NextResponse.json(
          { error: "Meeting title cannot be empty" },
          { status: 400 }
        )
      }
      data.title = title
    }

    if (description !== undefined) {
      data.description = description || null
    }

    if (scheduledAt !== undefined) {
      if (!scheduledAt) {
        return NextResponse.json(
          { error: "Meeting time cannot be empty" },
          { status: 400 }
        )
      }
      const parsedDate = new Date(scheduledAt)
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduledAt date" },
          { status: 400 }
        )
      }
      data.scheduledAt = parsedDate
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      )
    }

    const meeting = await prisma.meeting.update({
      where: { id: targetMeetingId },
      data,
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
        userId: meeting.attendeeId,
        title: "Meeting updated",
        body: `The meeting "${meeting.title}" was updated.`,
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
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ meetingId: string }> }
) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { meetingId } = await context.params
    const targetMeetingId = (meetingId || "").trim()

    if (!targetMeetingId) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }

    const existing = await prisma.meeting.findUnique({
      where: { id: targetMeetingId },
      select: {
        id: true,
        organizerId: true,
        attendeeId: true,
        title: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
    }

    if (existing.organizerId !== payload.sub) {
      return NextResponse.json(
        { error: "Only the meeting organizer can cancel this meeting" },
        { status: 403 }
      )
    }

    await prisma.meeting.delete({
      where: { id: targetMeetingId },
    })

    await prisma.notification.create({
      data: {
        userId: existing.attendeeId,
        title: "Meeting cancelled",
        body: `The meeting "${existing.title}" was cancelled.`,
        type: "meeting",
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
