/* eslint-disable no-console */
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000"

function logSection(title) {
  console.log(`\n=== ${title} ===`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers["Content-Type"] = "application/json"

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { status: res.status, ok: res.ok, data }
}

async function login(email, password, expectedStatus = 200) {
  const res = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  })

  if (res.status !== expectedStatus) {
    throw new Error(
      `Login ${email} expected ${expectedStatus}, got ${res.status}: ${JSON.stringify(
        res.data
      )}`
    )
  }

  return res.data
}

async function run() {
  const results = []
  const runCase = async (name, fn) => {
    try {
      await fn()
      results.push({ name, ok: true })
      console.log(`PASS: ${name}`)
    } catch (err) {
      results.push({ name, ok: false, error: err.message })
      console.error(`FAIL: ${name}\n  ${err.message}`)
    }
  }

  logSection("Health")
  await runCase("API health check", async () => {
    const res = await api("/api/health")
    assert(res.status === 200, `Expected 200, got ${res.status}`)
  })

  logSection("Security Preconditions")
  await runCase("Suspended user cannot login", async () => {
    await login("suspended.student@student-demo.local", "Demo123!", 403)
  })
  await runCase("Pending user cannot login", async () => {
    await login("invited.student@student-demo.local", "Demo123!", 403)
  })

  let studentAhmed = null
  let studentAisha = null
  let studentMaria = null
  let supervisorDavid = null
  let supervisorSarah = null
  let supervisorManaged = null
  let admin = null
  let aishaRequestId = ""
  let mariaRequestId = ""
  let managedStudentId = ""
  let managedSupervisorId = ""

  logSection("Student Flows")
  await runCase("Student Ahmed login + dashboard/project/timeline endpoints", async () => {
    studentAhmed = await login("ahmed.khan@student-demo.local", "Demo123!")
    const token = studentAhmed.token

    const me = await api("/api/auth/me", { token })
    assert(me.status === 200, `me status ${me.status}`)
    assert(me.data?.user?.role === "STUDENT", "Expected STUDENT role")

    const profile = await api("/api/student/profile", { token })
    assert(profile.status === 200, `profile status ${profile.status}`)
    assert(profile.data?.supervisor?.id, "Expected assigned supervisor for Ahmed")

    const project = await api("/api/student/project", { token })
    assert(project.status === 200, `project status ${project.status}`)
    assert(project.data?.project?.id, "Expected student project")

    const timeline = await api("/api/student/timeline", { token })
    assert(timeline.status === 200, `timeline status ${timeline.status}`)
    assert(
      Array.isArray(timeline.data?.milestones) && timeline.data.milestones.length > 0,
      "Expected milestones in timeline"
    )

    const supervisors = await api("/api/supervisor/find-supervisor", { token })
    assert(supervisors.status === 200, `find-supervisor status ${supervisors.status}`)
    assert(Array.isArray(supervisors.data?.supervisors), "Expected supervisors list")

    const duplicate = await api("/api/student/request-supervisor", {
      method: "POST",
      token,
      body: {
        supervisorId: profile.data.supervisor.id,
        message: "Testing duplicate request prevention",
      },
    })
    assert(duplicate.status === 400, `Expected duplicate 400, got ${duplicate.status}`)

    const notifications = await api("/api/notifications", { token })
    assert(notifications.status === 200, `notifications status ${notifications.status}`)

    const messages = await api(
      `/api/messages?userId=${encodeURIComponent(profile.data.supervisor.id)}`,
      { token }
    )
    assert(messages.status === 200, `messages status ${messages.status}`)

    const meetings = await api(
      `/api/meetings?userId=${encodeURIComponent(profile.data.supervisor.id)}`,
      { token }
    )
    assert(meetings.status === 200, `meetings status ${meetings.status}`)
  })

  await runCase("Student Aisha send request + duplicate prevention", async () => {
    studentAisha = await login("aisha.patel@student-demo.local", "Demo123!")
    const token = studentAisha.token
    const list = await api("/api/supervisor/find-supervisor", { token })
    assert(list.status === 200, `find-supervisor status ${list.status}`)

    const david = list.data.supervisors.find((s) =>
      s.email.includes("david.chen@supervisor-demo.local")
    )
    assert(david, "Could not find David supervisor")

    const createReq = await api("/api/student/request-supervisor", {
      method: "POST",
      token,
      body: {
        supervisorId: david.id,
        message: "Please review my computer vision proposal.",
      },
    })
    assert(createReq.status === 201, `Expected 201, got ${createReq.status}`)
    aishaRequestId = createReq.data?.request?.id || ""
    assert(aishaRequestId, "Expected request id")

    const duplicateReq = await api("/api/student/request-supervisor", {
      method: "POST",
      token,
      body: {
        supervisorId: david.id,
        message: "Duplicate request check",
      },
    })
    assert(
      duplicateReq.status === 400,
      `Expected duplicate 400, got ${duplicateReq.status}`
    )
  })

  await runCase("Student Tom regenerate initial plan", async () => {
    const tom = await login("tom.reyes@student-demo.local", "Demo123!")
    const res = await api("/api/student/timeline", {
      method: "PUT",
      token: tom.token,
      body: {
        action: "regenerate_initial_plan",
      },
    })
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data?.regeneration, "Expected regeneration payload")
    assert(
      typeof res.data?.regeneration?.preservedCount === "number",
      "Expected preservedCount"
    )
  })

  await runCase("Student Ahmed delay milestone + smart reschedule", async () => {
    const timeline = await api("/api/student/timeline", { token: studentAhmed.token })
    assert(timeline.status === 200, `timeline status ${timeline.status}`)
    const target = (timeline.data?.milestones || []).find(
      (m) => m.status === "pending" && !m.isCriticalPath
    )
    assert(target, "No pending non-critical milestone found to delay")

    const delayed = await api("/api/student/timeline", {
      method: "PUT",
      token: studentAhmed.token,
      body: {
        milestoneId: target.id,
        status: "delayed",
        delayDays: 5,
      },
    })
    assert(delayed.status === 200, `Expected 200, got ${delayed.status}`)
    assert(delayed.data?.milestone?.status === "delayed", "Milestone not delayed")
    assert(delayed.data?.recalculation, "Expected recalculation metadata")
  })

  logSection("Supervisor Flows")
  await runCase("Supervisor David login + dashboard endpoints", async () => {
    supervisorDavid = await login("david.chen@supervisor-demo.local", "Demo123!")
    const token = supervisorDavid.token

    const me = await api("/api/auth/me", { token })
    assert(me.status === 200, `me status ${me.status}`)
    assert(me.data?.user?.role === "SUPERVISOR", "Expected SUPERVISOR role")

    const students = await api("/api/supervisor/students", { token })
    assert(students.status === 200, `students status ${students.status}`)

    const requests = await api("/api/supervisor/requests", { token })
    assert(requests.status === 200, `requests status ${requests.status}`)
  })

  await runCase("Supervisor David decline Aisha request", async () => {
    const res = await api("/api/supervisor/respond-request", {
      method: "POST",
      token: supervisorDavid.token,
      body: {
        requestId: aishaRequestId,
        action: "declined",
      },
    })
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data?.request?.status === "declined", "Expected declined status")
  })

  await runCase("Supervisor David accept Maria request", async () => {
    const requests = await api("/api/supervisor/requests", { token: supervisorDavid.token })
    assert(requests.status === 200, `requests status ${requests.status}`)
    const pendingMaria = (requests.data?.requests || []).find(
      (r) =>
        r.status === "pending" &&
        r.student?.email === "maria.lee@student-demo.local"
    )
    assert(pendingMaria, "No pending Maria request found")
    mariaRequestId = pendingMaria.id

    const res = await api("/api/supervisor/respond-request", {
      method: "POST",
      token: supervisorDavid.token,
      body: {
        requestId: mariaRequestId,
        action: "accepted",
      },
    })
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data?.request?.status === "accepted", "Expected accepted status")
  })

  await runCase("Supervisor student details + feedback + capacity checks", async () => {
    const students = await api("/api/supervisor/students", { token: supervisorDavid.token })
    assert(students.status === 200, `students status ${students.status}`)
    const maria = (students.data?.students || []).find(
      (s) => s.student?.email === "maria.lee@student-demo.local"
    )
    assert(maria, "Maria not present in supervisor students after acceptance")

    const detail = await api(`/api/supervisor/students/${maria.student.id}`, {
      token: supervisorDavid.token,
    })
    assert(detail.status === 200, `student detail status ${detail.status}`)
    assert(detail.data?.student?.id === maria.student.id, "Detail student mismatch")

    const milestone = detail.data?.project?.milestones?.[0]
    assert(milestone?.id, "No milestone available for feedback test")

    const feedback = await api("/api/supervisor/milestone-feedback", {
      method: "POST",
      token: supervisorDavid.token,
      body: {
        milestoneId: milestone.id,
        feedback: "Good progress. Please tighten your evaluation metrics.",
      },
    })
    assert(feedback.status === 200, `feedback status ${feedback.status}`)

    const me = await api("/api/auth/me", { token: supervisorDavid.token })
    const maxCap = me.data?.user?.supervisorProfile?.maxCapacity ?? 0
    const assigned = (students.data?.students || []).length
    assert(assigned <= maxCap, `Capacity overflow: ${assigned} > ${maxCap}`)

    const notifications = await api("/api/notifications", { token: supervisorDavid.token })
    assert(notifications.status === 200, "Supervisor notifications failed")

    const messages = await api(
      `/api/messages?userId=${encodeURIComponent("user_student_maria")}`,
      { token: supervisorDavid.token }
    )
    assert(messages.status === 200, "Supervisor messages failed")

    const meetings = await api("/api/meetings", { token: supervisorDavid.token })
    assert(meetings.status === 200, "Supervisor meetings failed")
  })

  await runCase("Student request state updates reflected after supervisor actions", async () => {
    const aishaProfile = await api("/api/student/profile", { token: studentAisha.token })
    assert(aishaProfile.status === 200, "Aisha profile fetch failed")
    assert(
      aishaProfile.data?.latestRequest?.status === "declined",
      `Expected Aisha declined, got ${aishaProfile.data?.latestRequest?.status}`
    )

    studentMaria = await login("maria.lee@student-demo.local", "Demo123!")
    const mariaProfile = await api("/api/student/profile", { token: studentMaria.token })
    assert(mariaProfile.status === 200, "Maria profile fetch failed")
    assert(
      mariaProfile.data?.latestRequest?.status === "accepted",
      `Expected Maria accepted, got ${mariaProfile.data?.latestRequest?.status}`
    )
  })

  logSection("Admin Flows")
  await runCase("Admin login + list users", async () => {
    admin = await login("admin@supervisor-match.local", "Admin123!")
    const users = await api("/api/admin/users", { token: admin.token })
    assert(users.status === 200, `admin users status ${users.status}`)
    assert(Array.isArray(users.data?.users), "Expected users array")

    const usersByEmail = new Map(users.data.users.map((u) => [u.email, u.id]))
    managedStudentId = usersByEmail.get("managed.student@student-demo.local") || ""
    managedSupervisorId =
      usersByEmail.get("managed.supervisor@supervisor-demo.local") || ""

    assert(managedStudentId, "Managed student id not found")
    assert(managedSupervisorId, "Managed supervisor id not found")
  })

  await runCase("Admin invite user (pending account)", async () => {
    const inviteEmail = `e2e.invited+${Date.now()}@student-demo.local`
    const res = await api("/api/admin/users", {
      method: "POST",
      token: admin.token,
      body: {
        email: inviteEmail,
        role: "STUDENT",
      },
    })
    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.data?.user?.status === "PENDING", "Expected invited user to be PENDING")

    await login(inviteEmail, "Demo123!", 403)
  })

  await runCase("Admin suspend + reactivate user", async () => {
    const suspend = await api("/api/admin/users", {
      method: "PUT",
      token: admin.token,
      body: {
        userId: managedStudentId,
        status: "SUSPENDED",
      },
    })
    assert(suspend.status === 200, `Suspend failed: ${suspend.status}`)
    assert(suspend.data?.user?.status === "SUSPENDED", "User not suspended")

    const reactivate = await api("/api/admin/users", {
      method: "PUT",
      token: admin.token,
      body: {
        userId: managedStudentId,
        status: "ACTIVE",
      },
    })
    assert(reactivate.status === 200, `Reactivate failed: ${reactivate.status}`)
    assert(reactivate.data?.user?.status === "ACTIVE", "User not reactivated")
  })

  await runCase("Admin reset password + temporary password login", async () => {
    const reset = await api("/api/admin/users", {
      method: "PUT",
      token: admin.token,
      body: {
        action: "reset_password",
        userId: managedStudentId,
      },
    })
    assert(reset.status === 200, `Reset password failed: ${reset.status}`)
    const tempPassword = reset.data?.temporaryPassword
    assert(typeof tempPassword === "string" && tempPassword.length > 0, "No temp password")

    await login("managed.student@student-demo.local", "Demo123!", 401)
    await login("managed.student@student-demo.local", tempPassword, 200)
  })

  await runCase("Admin end sessions invalidates existing token", async () => {
    supervisorManaged = await login(
      "managed.supervisor@supervisor-demo.local",
      "Demo123!"
    )
    const oldToken = supervisorManaged.token

    const endSessions = await api("/api/admin/users", {
      method: "PUT",
      token: admin.token,
      body: {
        action: "end_sessions",
        userId: managedSupervisorId,
      },
    })
    assert(endSessions.status === 200, `end_sessions failed: ${endSessions.status}`)

    const meOld = await api("/api/auth/me", { token: oldToken })
    assert(
      meOld.status === 403,
      `Old token should be invalidated, got ${meOld.status}`
    )

    await login("managed.supervisor@supervisor-demo.local", "Demo123!", 200)
  })

  await runCase("Admin view details + send email action", async () => {
    const detail = await api(`/api/admin/users?id=${encodeURIComponent(managedStudentId)}`, {
      token: admin.token,
    })
    assert(detail.status === 200, `Details status ${detail.status}`)
    assert(detail.data?.metrics, "Expected user metrics in details")

    const sendEmail = await api("/api/admin/users", {
      method: "PUT",
      token: admin.token,
      body: {
        action: "send_email",
        userIds: [managedStudentId, managedSupervisorId],
        subject: "E2E admin notice",
        message: "This is an automated end-to-end test notification.",
      },
    })
    assert(sendEmail.status === 200, `send_email failed: ${sendEmail.status}`)
    assert(sendEmail.data?.sentCount >= 2, "Expected sentCount >= 2")
  })

  logSection("Manual / UI-only Items")
  console.log(
    "- Export CSV is client-side UI logic in admin users page and requires browser click validation."
  )
  console.log(
    "- Deployment/prod smoke requires your hosting target + production environment access."
  )

  logSection("Summary")
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`Passed: ${passed}/${results.length}`)

  if (failed.length > 0) {
    console.log("Failed cases:")
    failed.forEach((item) => {
      console.log(`- ${item.name}: ${item.error}`)
    })
    process.exitCode = 1
  } else {
    console.log("All automated API flow checks passed.")
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
