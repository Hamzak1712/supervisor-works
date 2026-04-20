import { AccountStatus, PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_PASSWORD = "Demo123!"
const ADMIN_PASSWORD = "Admin123!"
const BASE_DATE = new Date("2026-04-20T09:00:00.000Z")

const ids = {
  adminMain: "user_admin_main",
  adminOps: "user_admin_ops",

  supervisorSarah: "user_supervisor_sarah",
  supervisorDavid: "user_supervisor_david",
  supervisorFatima: "user_supervisor_fatima",
  supervisorManaged: "user_supervisor_managed",
  supervisorPending: "user_supervisor_pending",

  studentAhmed: "user_student_ahmed",
  studentMaria: "user_student_maria",
  studentJohn: "user_student_john",
  studentAisha: "user_student_aisha",
  studentTom: "user_student_tom",
  studentManaged: "user_student_managed",
  studentSuspended: "user_student_suspended",
  studentPending: "user_student_pending",
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function resetDatabase() {
  await prisma.notification.deleteMany()
  await prisma.message.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.supervisionRequest.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.project.deleteMany()
  await prisma.studentProfile.deleteMany()
  await prisma.supervisorProfile.deleteMany()
  await prisma.user.deleteMany()
}

async function seedUsers() {
  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  await prisma.user.createMany({
    data: [
      {
        id: ids.adminMain,
        email: "admin@supervisor-match.local",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.adminOps,
        email: "admin.ops@supervisor-match.local",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        sessionVersion: 1,
      },

      {
        id: ids.supervisorSarah,
        email: "sarah.wilson@supervisor-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.SUPERVISOR,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.supervisorDavid,
        email: "david.chen@supervisor-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.SUPERVISOR,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.supervisorFatima,
        email: "fatima.noor@supervisor-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.SUPERVISOR,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.supervisorManaged,
        email: "managed.supervisor@supervisor-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.SUPERVISOR,
        status: AccountStatus.ACTIVE,
        sessionVersion: 2,
      },
      {
        id: ids.supervisorPending,
        email: "invited.supervisor@supervisor-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.SUPERVISOR,
        status: AccountStatus.PENDING,
        sessionVersion: 0,
      },

      {
        id: ids.studentAhmed,
        email: "ahmed.khan@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.studentMaria,
        email: "maria.lee@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.studentJohn,
        email: "john.carter@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.studentAisha,
        email: "aisha.patel@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.studentTom,
        email: "tom.reyes@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 0,
      },
      {
        id: ids.studentManaged,
        email: "managed.student@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        sessionVersion: 2,
      },
      {
        id: ids.studentSuspended,
        email: "suspended.student@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.SUSPENDED,
        sessionVersion: 4,
      },
      {
        id: ids.studentPending,
        email: "invited.student@student-demo.local",
        passwordHash: demoPasswordHash,
        role: Role.STUDENT,
        status: AccountStatus.PENDING,
        sessionVersion: 0,
      },
    ],
  })
}

async function seedProfiles() {
  await prisma.supervisorProfile.createMany({
    data: [
      {
        userId: ids.supervisorSarah,
        fullName: "Dr Sarah Wilson",
        expertise:
          "machine learning, healthcare ai, natural language processing, predictive analytics",
        maxCapacity: 5,
      },
      {
        userId: ids.supervisorDavid,
        fullName: "Dr David Chen",
        expertise:
          "data engineering, business analytics, data visualization, cloud platforms",
        maxCapacity: 4,
      },
      {
        userId: ids.supervisorFatima,
        fullName: "Dr Fatima Noor",
        expertise:
          "cybersecurity, digital forensics, secure systems, privacy engineering",
        maxCapacity: 3,
      },
      {
        userId: ids.supervisorManaged,
        fullName: "Dr Irene Novak",
        expertise:
          "software architecture, distributed systems, backend engineering",
        maxCapacity: 2,
      },
      {
        userId: ids.supervisorPending,
        fullName: "Dr Pending Invite",
        expertise: "human computer interaction, ux research",
        maxCapacity: 3,
      },
    ],
  })

  await prisma.studentProfile.createMany({
    data: [
      {
        userId: ids.studentAhmed,
        fullName: "Ahmed Khan",
        skills: "python, pytorch, data analysis, sql",
        interests: "medical ai, nlp, predictive modelling",
        supervisorId: ids.supervisorSarah,
      },
      {
        userId: ids.studentMaria,
        fullName: "Maria Lee",
        skills: "react, sql, power bi",
        interests: "analytics dashboards, product analytics, business intelligence",
      },
      {
        userId: ids.studentJohn,
        fullName: "John Carter",
        skills: "networking, linux, python",
        interests: "cybersecurity, intrusion detection, digital forensics",
      },
      {
        userId: ids.studentAisha,
        fullName: "Aisha Patel",
        skills: "python, opencv, tensorflow",
        interests: "computer vision, deep learning, model optimization",
      },
      {
        userId: ids.studentTom,
        fullName: "Tom Reyes",
        skills: "next.js, node.js, postgresql, docker",
        interests: "full stack systems, architecture, devops",
        supervisorId: ids.supervisorSarah,
      },
      {
        userId: ids.studentManaged,
        fullName: "Managed Student",
        skills: "java, spring boot",
        interests: "enterprise systems, software testing",
      },
      {
        userId: ids.studentSuspended,
        fullName: "Suspended Student",
        skills: "python",
        interests: "ai",
      },
      {
        userId: ids.studentPending,
        fullName: "Pending Student Invite",
        skills: "",
        interests: "",
      },
    ],
  })
}

async function seedProjectsAndMilestones() {
  const ahmedProjectCreated = addDays(BASE_DATE, -120)
  const mariaProjectCreated = addDays(BASE_DATE, -70)
  const johnProjectCreated = addDays(BASE_DATE, -90)
  const aishaProjectCreated = addDays(BASE_DATE, -20)
  const tomProjectCreated = addDays(BASE_DATE, -140)

  await prisma.project.createMany({
    data: [
      {
        id: "project_ahmed",
        studentId: ids.studentAhmed,
        title: "Clinical NLP Triage Assistant",
        description:
          "Build an NLP assistant that prioritises urgent patient reports and routes them to the right department.",
        keywords: "nlp, healthcare, triage, transformers, machine learning",
        status: "active",
        createdAt: ahmedProjectCreated,
      },
      {
        id: "project_maria",
        studentId: ids.studentMaria,
        title: "Analytics Dashboard for Student Retention",
        description:
          "Design a dashboard to monitor retention risk and interventions for university students.",
        keywords: "analytics, dashboard, retention, data visualization",
        status: "pending_supervisor",
        createdAt: mariaProjectCreated,
      },
      {
        id: "project_john",
        studentId: ids.studentJohn,
        title: "SOC Alert Correlation Tool",
        description:
          "Investigate event correlation to reduce false positives in a security operations center.",
        keywords: "security, soc, correlation, cyber",
        status: "pending_supervisor",
        createdAt: johnProjectCreated,
      },
      {
        id: "project_aisha",
        studentId: ids.studentAisha,
        title: "Vision-Based Attendance Verification",
        description:
          "Evaluate computer vision techniques for secure and privacy-aware attendance verification.",
        keywords: "computer vision, face recognition, deep learning",
        status: "active",
        createdAt: aishaProjectCreated,
      },
      {
        id: "project_tom",
        studentId: ids.studentTom,
        title: "AI Supervisor and Planning Platform",
        description:
          "Develop a platform for supervisor matching, timeline planning, and adaptive milestone management.",
        keywords: "full stack, matching, planning, timeline, web",
        status: "active",
        createdAt: tomProjectCreated,
      },
      {
        id: "project_managed_student",
        studentId: ids.studentManaged,
        title: "Managed User Demo Project",
        description: "A lightweight project used in admin management demos.",
        keywords: "demo, management",
        status: "draft",
        createdAt: addDays(BASE_DATE, -15),
      },
    ],
  })

  await prisma.milestone.createMany({
    data: [
      {
        id: "ms_ahmed_1",
        projectId: "project_ahmed",
        title: "Project Scope and Problem Definition",
        description: "Finalised problem statement and success criteria.",
        dueDate: addDays(BASE_DATE, -100),
        status: "completed",
        completedDate: addDays(BASE_DATE, -101),
      },
      {
        id: "ms_ahmed_2",
        projectId: "project_ahmed",
        title: "Literature Review and Background Study",
        description: "Reviewed 25+ papers and benchmarked baseline approaches.",
        dueDate: addDays(BASE_DATE, -85),
        status: "completed",
        completedDate: addDays(BASE_DATE, -83),
      },
      {
        id: "ms_ahmed_3",
        projectId: "project_ahmed",
        title: "Requirements and Evaluation Plan",
        description: "Defined measurable precision/recall targets.",
        dueDate: addDays(BASE_DATE, -70),
        status: "completed",
        completedDate: addDays(BASE_DATE, -68),
      },
      {
        id: "ms_ahmed_4",
        projectId: "project_ahmed",
        title: "System Architecture and Design",
        description:
          "Delayed by dataset access issues. Smart reschedule shifted downstream tasks by one week.",
        dueDate: addDays(BASE_DATE, -20),
        status: "delayed",
        feedback:
          "Delay acknowledged. Downstream milestones were shifted automatically to protect critical-path milestones.",
      },
      {
        id: "ms_ahmed_5",
        projectId: "project_ahmed",
        title: "Model Development and Validation",
        description: "Rescheduled prototype and evaluation window.",
        dueDate: addDays(BASE_DATE, 7),
        status: "pending",
      },
      {
        id: "ms_ahmed_6",
        projectId: "project_ahmed",
        title: "Interim Progress Demonstration (IPD)",
        description: "Critical checkpoint with supervisor panel.",
        dueDate: addDays(BASE_DATE, 21),
        status: "pending",
        isCriticalPath: true,
      },
      {
        id: "ms_ahmed_7",
        projectId: "project_ahmed",
        title: "Testing, Evaluation, and Refinement",
        description: "Quantitative and qualitative validation cycle.",
        dueDate: addDays(BASE_DATE, 35),
        status: "pending",
      },
      {
        id: "ms_ahmed_8",
        projectId: "project_ahmed",
        title: "Final Report Submission",
        description: "Complete dissertation with findings and limitations.",
        dueDate: addDays(BASE_DATE, 49),
        status: "pending",
        isCriticalPath: true,
      },

      {
        id: "ms_maria_1",
        projectId: "project_maria",
        title: "Data Source Audit",
        description: "Catalogued source systems and field quality.",
        dueDate: addDays(BASE_DATE, 5),
        status: "pending",
      },
      {
        id: "ms_maria_2",
        projectId: "project_maria",
        title: "Dashboard Wireframes",
        description: "Prepared first dashboard interaction flow.",
        dueDate: addDays(BASE_DATE, 14),
        status: "pending",
      },

      {
        id: "ms_tom_1",
        projectId: "project_tom",
        title: "Project Scope and Problem Definition",
        description: "Completed before plan regeneration.",
        dueDate: addDays(BASE_DATE, -120),
        status: "completed",
        completedDate: addDays(BASE_DATE, -118),
      },
      {
        id: "ms_tom_2",
        projectId: "project_tom",
        title: "Literature Review and Background Study",
        description: "In progress and preserved during regeneration.",
        dueDate: addDays(BASE_DATE, -90),
        status: "in_progress",
      },
      {
        id: "ms_tom_3",
        projectId: "project_tom",
        title: "Requirements and Evaluation Plan",
        description: "Regenerated milestone set from updated project idea.",
        dueDate: addDays(BASE_DATE, 6),
        status: "pending",
      },
      {
        id: "ms_tom_4",
        projectId: "project_tom",
        title: "System Architecture and Design",
        description: "Regenerated milestone set from updated project idea.",
        dueDate: addDays(BASE_DATE, 18),
        status: "pending",
      },
      {
        id: "ms_tom_5",
        projectId: "project_tom",
        title: "Prototype Implementation",
        description: "Regenerated prototype implementation phase.",
        dueDate: addDays(BASE_DATE, 32),
        status: "pending",
      },
      {
        id: "ms_tom_6",
        projectId: "project_tom",
        title: "Interim Progress Demonstration (IPD)",
        description: "Critical checkpoint retained in regenerated sequence.",
        dueDate: addDays(BASE_DATE, 46),
        status: "pending",
        isCriticalPath: true,
      },
      {
        id: "ms_tom_7",
        projectId: "project_tom",
        title: "Final Report Submission",
        description: "Critical deliverable in regenerated sequence.",
        dueDate: addDays(BASE_DATE, 74),
        status: "pending",
        isCriticalPath: true,
      },
      {
        id: "ms_tom_8",
        projectId: "project_tom",
        title: "Final Viva Preparation",
        description: "Final critical checkpoint in regenerated sequence.",
        dueDate: addDays(BASE_DATE, 82),
        status: "pending",
        isCriticalPath: true,
      },
    ],
  })
}

async function seedRequests() {
  await prisma.supervisionRequest.createMany({
    data: [
      {
        id: "req_ahmed_sarah_accepted",
        studentId: ids.studentAhmed,
        supervisorId: ids.supervisorSarah,
        projectId: "project_ahmed",
        status: "accepted",
        message: "I would value your guidance on clinical NLP evaluation.",
        createdAt: addDays(BASE_DATE, -60),
        respondedAt: addDays(BASE_DATE, -58),
        responseMessage: "Happy to supervise this project. Let us begin with milestones.",
      },
      {
        id: "req_ahmed_david_declined",
        studentId: ids.studentAhmed,
        supervisorId: ids.supervisorDavid,
        projectId: "project_ahmed",
        status: "declined",
        message: "Requesting supervision support for healthcare analytics.",
        createdAt: addDays(BASE_DATE, -60),
        respondedAt: addDays(BASE_DATE, -58),
        responseMessage: "Another supervisor accepted this student.",
      },
      {
        id: "req_maria_david_pending",
        studentId: ids.studentMaria,
        supervisorId: ids.supervisorDavid,
        projectId: "project_maria",
        status: "pending",
        message: "I believe your analytics expertise fits my project well.",
        createdAt: addDays(BASE_DATE, -4),
      },
      {
        id: "req_john_fatima_declined",
        studentId: ids.studentJohn,
        supervisorId: ids.supervisorFatima,
        projectId: "project_john",
        status: "declined",
        message: "I would like supervision support for SOC alert correlation.",
        createdAt: addDays(BASE_DATE, -18),
        respondedAt: addDays(BASE_DATE, -15),
        responseMessage: "I am currently at supervision capacity for this topic area.",
      },
      {
        id: "req_tom_sarah_accepted",
        studentId: ids.studentTom,
        supervisorId: ids.supervisorSarah,
        projectId: "project_tom",
        status: "accepted",
        message: "Can you supervise my planning and matching platform dissertation?",
        createdAt: addDays(BASE_DATE, -100),
        respondedAt: addDays(BASE_DATE, -96),
        responseMessage: "Accepted. Keep your timeline updated weekly.",
      },
    ],
  })
}

async function seedMessagesAndMeetings() {
  await prisma.message.createMany({
    data: [
      {
        id: "msg_1",
        senderId: ids.studentAhmed,
        receiverId: ids.supervisorSarah,
        body: "Hi Dr Sarah, I uploaded my revised architecture section.",
        createdAt: addDays(BASE_DATE, -3),
      },
      {
        id: "msg_2",
        senderId: ids.supervisorSarah,
        receiverId: ids.studentAhmed,
        body: "Great, I will review it before our meeting.",
        createdAt: addDays(BASE_DATE, -3),
      },
      {
        id: "msg_3",
        senderId: ids.supervisorSarah,
        receiverId: ids.studentAhmed,
        body: "Please include error analysis for triage misclassification.",
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        id: "msg_4",
        senderId: ids.studentAhmed,
        receiverId: ids.supervisorSarah,
        body: "Understood, I am adding that to the evaluation section.",
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        id: "msg_5",
        senderId: ids.studentMaria,
        receiverId: ids.supervisorDavid,
        body: "Hello Dr David, following up on my supervision request.",
        createdAt: addDays(BASE_DATE, -1),
      },
      {
        id: "msg_6",
        senderId: ids.supervisorDavid,
        receiverId: ids.studentMaria,
        body: "Thanks Maria, I will review your proposal this week.",
        createdAt: addDays(BASE_DATE, -1),
      },
    ],
  })

  await prisma.meeting.createMany({
    data: [
      {
        id: "meeting_1",
        organizerId: ids.supervisorSarah,
        attendeeId: ids.studentAhmed,
        title: "Weekly Progress Review",
        description: "Review delayed milestone impact and revised timeline.",
        scheduledAt: addDays(BASE_DATE, -6),
        createdAt: addDays(BASE_DATE, -10),
      },
      {
        id: "meeting_2",
        organizerId: ids.supervisorSarah,
        attendeeId: ids.studentAhmed,
        title: "Reschedule Follow-up",
        description: "Validate smart reschedule and critical-path protection.",
        scheduledAt: addDays(BASE_DATE, 3),
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        id: "meeting_3",
        organizerId: ids.studentTom,
        attendeeId: ids.supervisorSarah,
        title: "Regenerated Plan Walkthrough",
        description: "Discuss regenerated milestones and preserved in-progress tasks.",
        scheduledAt: addDays(BASE_DATE, 5),
        createdAt: addDays(BASE_DATE, -1),
      },
      {
        id: "meeting_4",
        organizerId: ids.supervisorDavid,
        attendeeId: ids.studentMaria,
        title: "Request Clarification Meeting",
        description: "Clarify project scope and expected deliverables.",
        scheduledAt: addDays(BASE_DATE, 8),
        createdAt: BASE_DATE,
      },
    ],
  })
}

async function seedNotifications() {
  await prisma.notification.createMany({
    data: [
      {
        userId: ids.studentAhmed,
        title: "Supervision request accepted",
        body: "A supervisor accepted your request and has been assigned to your project.",
        type: "request_update",
        read: true,
        createdAt: addDays(BASE_DATE, -58),
      },
      {
        userId: ids.studentAhmed,
        title: "Milestone delayed and schedule adapted",
        body: "A delayed milestone triggered smart downstream rescheduling.",
        type: "timeline_update",
        read: false,
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        userId: ids.studentAhmed,
        title: "New message",
        body: "You received a new message.",
        type: "message",
        read: false,
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        userId: ids.studentAhmed,
        title: "Meeting updated",
        body: "The meeting \"Reschedule Follow-up\" was updated.",
        type: "meeting",
        read: false,
        createdAt: addDays(BASE_DATE, -1),
      },

      {
        userId: ids.studentMaria,
        title: "Supervision request pending review",
        body: "Your request is currently pending with the selected supervisor.",
        type: "request_update",
        read: false,
        createdAt: addDays(BASE_DATE, -1),
      },
      {
        userId: ids.studentJohn,
        title: "Supervision request declined",
        body: "A supervisor declined your supervision request.",
        type: "request_update",
        read: false,
        createdAt: addDays(BASE_DATE, -15),
      },
      {
        userId: ids.studentAisha,
        title: "Initial plan ready",
        body: "Open timeline to auto-generate your initial milestone plan.",
        type: "timeline_update",
        read: false,
        createdAt: addDays(BASE_DATE, -1),
      },
      {
        userId: ids.studentTom,
        title: "Initial plan regenerated",
        body: "Pending milestones were regenerated while completed/in-progress tasks were preserved.",
        type: "timeline_update",
        read: false,
        createdAt: addDays(BASE_DATE, -1),
      },
      {
        userId: ids.studentSuspended,
        title: "Account suspended",
        body: "Your account has been suspended by an administrator.",
        type: "account_security",
        read: false,
        createdAt: addDays(BASE_DATE, -3),
      },
      {
        userId: ids.studentPending,
        title: "Invitation pending activation",
        body: "Your account invite is pending activation by an administrator.",
        type: "account_status",
        read: false,
        createdAt: addDays(BASE_DATE, -2),
      },

      {
        userId: ids.supervisorSarah,
        title: "New supervision request",
        body: "A student sent you a supervision request for \"AI Supervisor and Planning Platform\".",
        type: "supervision_request",
        read: true,
        createdAt: addDays(BASE_DATE, -100),
      },
      {
        userId: ids.supervisorDavid,
        title: "New supervision request",
        body: "A student sent you a supervision request for \"Analytics Dashboard for Student Retention\".",
        type: "supervision_request",
        read: false,
        createdAt: addDays(BASE_DATE, -4),
      },

      {
        userId: ids.studentManaged,
        title: "Admin message",
        body: "Your profile has been included in the admin-managed demo cohort.",
        type: "admin_message",
        read: false,
        createdAt: addDays(BASE_DATE, -2),
      },
      {
        userId: ids.supervisorManaged,
        title: "Sessions ended",
        body: "An administrator ended all of your active sessions. Please sign in again.",
        type: "account_security",
        read: false,
        createdAt: addDays(BASE_DATE, -1),
      },
    ],
  })
}

async function main() {
  await resetDatabase()
  await seedUsers()
  await seedProfiles()
  await seedProjectsAndMilestones()
  await seedRequests()
  await seedMessagesAndMeetings()
  await seedNotifications()

  console.log("Demo seed completed successfully.")
  console.log("------------------------------------------------------------")
  console.log("Admin login:")
  console.log("  admin@supervisor-match.local / Admin123!")
  console.log("")
  console.log("Demo user password (all active demo accounts): Demo123!")
  console.log("Example active logins:")
  console.log("  - ahmed.khan@student-demo.local")
  console.log("  - maria.lee@student-demo.local")
  console.log("  - john.carter@student-demo.local")
  console.log("  - aisha.patel@student-demo.local")
  console.log("  - tom.reyes@student-demo.local")
  console.log("  - sarah.wilson@supervisor-demo.local")
  console.log("  - david.chen@supervisor-demo.local")
  console.log("  - fatima.noor@supervisor-demo.local")
  console.log("")
  console.log("Status demo accounts:")
  console.log("  - suspended.student@student-demo.local (SUSPENDED)")
  console.log("  - invited.student@student-demo.local (PENDING)")
  console.log("  - invited.supervisor@supervisor-demo.local (PENDING)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
