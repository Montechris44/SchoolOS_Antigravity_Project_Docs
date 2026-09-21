import assert from "node:assert/strict";
import test from "node:test";

import { pool } from "../src/db/pool";
import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

type App = ReturnType<typeof buildTestApp>;
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function call(app: App, method: Method, url: string, token: string, payload?: unknown) {
  const response = await app.inject({ method, url: `/api/v1${url}`, headers: { authorization: `Bearer ${token}` }, payload: payload as never });
  return { status: response.statusCode, body: response.json() as { data?: any; message?: string } };
}

async function activate(app: App, email: string, temporaryPassword: string, newPassword = "Activated12345") {
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: temporaryPassword } });
  const changed = await app.inject({
    method: "POST",
    url: "/api/v1/auth/force-update-password",
    headers: { authorization: `Bearer ${login.json().data.token}` },
    payload: { newPassword },
  });
  return changed.json().data.token as string;
}

test("portal features: attendance, timetable, homework, messaging, leave, dashboards and family access", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const school = await registerTestSchool(app, suffix);
  const emails: string[] = [];
  const mail = (name: string) => {
    const email = `${name}+${suffix}@backend-tests.local`;
    emails.push(email);
    return email;
  };

  t.after(async () => {
    await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [emails]);
    await app.close();
    await closeTestPool();
  });

  const owner = school.token;
  const cls = (await call(app, "POST", "/classes", owner, { name: "Primary 4", gradeLevel: "Primary 4" })).body.data;
  const math = (await call(app, "POST", "/subjects", owner, { name: "Mathematics", code: "MTH" })).body.data;

  const teacherEmail = mail("teacher");
  const createdTeacher = (await call(app, "POST", "/staff", owner, { firstName: "Tola", lastName: "Bello", email: teacherEmail, role: "teacher", phone: "08000000000" })).body.data;
  const teacher = await activate(app, teacherEmail, createdTeacher.temporaryPassword);
  const otherEmail = mail("other");
  const createdOther = (await call(app, "POST", "/staff", owner, { firstName: "Ola", lastName: "Other", email: otherEmail, role: "teacher", phone: "08000000001" })).body.data;
  const otherTeacher = await activate(app, otherEmail, createdOther.temporaryPassword);

  await call(app, "POST", "/teacher-assignments", owner, { teacherId: createdTeacher.userId, classId: cls.id, subjectId: math.id });
  await call(app, "PATCH", `/classes/${cls.id}/class-teacher`, owner, { teacherId: createdTeacher.userId });

  const guardianEmail = mail("guardian");
  const enrolled = await call(app, "POST", "/students", owner, {
    firstName: "Ife",
    lastName: "Adeleke",
    gender: "female",
    classId: cls.id,
    guardian: { firstName: "Bisi", lastName: "Adeleke", relationship: "mother", phone: "08022222222", email: guardianEmail },
  });
  assert.equal(enrolled.status, 201);
  const student = enrolled.body.data;
  emails.push(student.credentials.email);
  const studentToken = await activate(app, student.credentials.email, student.credentials.temporaryPassword);

  const stranger = await call(app, "POST", "/students", owner, { firstName: "Zed", lastName: "Other", gender: "male", classId: cls.id, guardian: { firstName: "Z", lastName: "Other", relationship: "father", phone: "08033333333", email: mail("strangerguardian") } });
  emails.push(stranger.body.data.credentials.email);

  const today = new Date().toISOString().slice(0, 10);

  await t.test("attendance: only the class's own teacher can take the register", async () => {
    const roster = await call(app, "GET", `/attendance/roster?classId=${cls.id}&date=${today}`, teacher);
    assert.equal(roster.status, 200);
    assert.equal(roster.body.data.length, 2);

    const foreignTeacher = await call(app, "GET", `/attendance/roster?classId=${cls.id}&date=${today}`, otherTeacher);
    assert.equal(foreignTeacher.status, 403);

    const marked = await call(app, "POST", "/attendance", teacher, {
      classId: cls.id,
      date: today,
      records: [{ studentId: student.id, status: "PRESENT" }, { studentId: stranger.body.data.id, status: "ABSENT", notes: "Sick" }],
    });
    assert.equal(marked.status, 200);

    const overview = await call(app, "GET", `/attendance/overview?date=${today}`, owner);
    assert.equal(overview.status, 200);
    assert.equal(overview.body.data.dailyRecords[0].present, 1);
    assert.equal(overview.body.data.dailyRecords[0].absent, 1);

    const mine = await call(app, "GET", "/attendance/me", studentToken);
    assert.equal(mine.body.data.summary.present, 1);

    const asStudentOverview = await call(app, "GET", `/attendance/overview?date=${today}`, studentToken);
    assert.equal(asStudentOverview.status, 403);
  });

  await t.test("staff attendance: sign-in only works while the administrator has attendance open", async () => {
    const closed = await call(app, "POST", "/staff-attendance/clock-in", teacher);
    assert.equal(closed.status, 403);

    assert.equal((await call(app, "POST", "/staff-attendance/session/open", owner, {})).status, 200);
    const asTeacherOpen = await call(app, "POST", "/staff-attendance/session/open", teacher, {});
    assert.equal(asTeacherOpen.status, 403);

    const signedIn = await call(app, "POST", "/staff-attendance/clock-in", teacher);
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
    assert.ok(signedIn.body.data.record.signInTime);
    assert.equal((await call(app, "POST", "/staff-attendance/clock-in", teacher)).status, 400, "cannot sign in twice");
    assert.equal((await call(app, "POST", "/staff-attendance/clock-out", teacher)).status, 200);

    const register = await call(app, "GET", `/staff-attendance?date=${today}`, owner);
    assert.equal(register.status, 200);
    assert.ok(register.body.data.records.find((row: { userId: string }) => row.userId === createdTeacher.userId).signInTime);

    const month = await call(app, "GET", "/staff-attendance/me/history", teacher);
    assert.equal(month.body.data.summary.daysRecorded, 1);
  });

  await t.test("timetable: conflicts are refused and each role sees the right slice", async () => {
    const entry = { classId: cls.id, subjectId: math.id, teacherId: createdTeacher.userId, dayOfWeek: new Date().getDay() || 7, startTime: "08:00", endTime: "09:00", room: "Lab 1" };
    const first = await call(app, "POST", "/timetable", owner, entry);
    assert.equal(first.status, 201, JSON.stringify(first.body));

    const clash = await call(app, "POST", "/timetable", owner, { ...entry, startTime: "08:30", endTime: "09:30" });
    assert.equal(clash.status, 409);

    const backwards = await call(app, "POST", "/timetable", owner, { ...entry, startTime: "10:00", endTime: "09:00" });
    assert.equal(backwards.status, 400);

    const mine = await call(app, "GET", "/teacher/timetable", teacher);
    assert.equal(mine.body.data.length, 1);
    const student_ = await call(app, "GET", "/student/timetable/week", studentToken);
    assert.equal(Object.values(student_.body.data).flat().length, 1);

    assert.equal((await call(app, "POST", "/timetable", teacher, { ...entry, startTime: "11:00", endTime: "12:00" })).status, 403);
  });

  await t.test("homework: set by the class teacher, submitted and graded", async () => {
    const assignment = await call(app, "POST", "/assignments", teacher, { classId: cls.id, subjectId: math.id, title: "Fractions worksheet", points: 20 });
    assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
    const assignmentId = assignment.body.data.id;

    assert.equal((await call(app, "POST", "/assignments", otherTeacher, { classId: cls.id, title: "Not mine" })).status, 403);

    const summary = await call(app, "GET", "/assignments/my/summary", studentToken);
    assert.equal(summary.body.data.pending, 1);

    const submitted = await call(app, "PATCH", `/assignments/my/${assignmentId}`, studentToken, { submissionText: "Done!", status: "SUBMITTED" });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));

    assert.equal((await call(app, "PATCH", `/assignments/${assignmentId}/submissions/${student.id}/grade`, teacher, { gradeScore: 25 })).status, 400);
    const graded = await call(app, "PATCH", `/assignments/${assignmentId}/submissions/${student.id}/grade`, teacher, { gradeScore: 18, feedback: "Good" });
    assert.equal(graded.status, 200);
    assert.equal((await call(app, "PATCH", `/assignments/my/${assignmentId}`, studentToken, { status: "SUBMITTED" })).status, 409, "graded work is locked");

    assert.equal((await call(app, "GET", `/assignments/${assignmentId}/submissions`, otherTeacher)).status, 404);
  });

  await t.test("messaging: rules by role, and students receive broadcasts", async () => {
    const toTeacher = await call(app, "POST", "/messages", owner, { recipientId: createdTeacher.userId, subject: "Hello", body: "Staff meeting at 2." });
    assert.equal(toTeacher.status, 201);
    assert.equal((await call(app, "POST", "/messages", studentToken, { recipientId: createdTeacher.userId, body: "hi" })).status, 403);

    const inbox = await call(app, "GET", "/messages/inbox", teacher);
    assert.equal(inbox.body.data.length, 1);

    const broadcast = await call(app, "POST", "/messages/broadcast", teacher, { classId: cls.id, subject: "Trip", body: "Bring lunch." });
    assert.equal(broadcast.status, 201);
    assert.equal(broadcast.body.data.recipientCount, 2, "both students in the class");
    assert.equal((await call(app, "POST", "/messages/broadcast", otherTeacher, { classId: cls.id, body: "x" })).status, 403);

    const seen = await call(app, "GET", "/messages/broadcasts", studentToken);
    assert.equal(seen.body.data.length, 1);

    const notes = await call(app, "GET", "/notifications", studentToken);
    assert.ok(notes.body.data.length >= 1);
    assert.equal((await call(app, "PATCH", "/notifications/read-all", studentToken)).status, 200);
  });

  await t.test("events and leave passes", async () => {
    const event = await call(app, "POST", "/events", owner, { title: "Inter-house sports", eventType: "SPORTS", startDate: new Date(Date.now() + 86_400_000).toISOString(), isPublic: true });
    assert.equal(event.status, 201);
    assert.equal((await call(app, "POST", "/events", teacher, { title: "Nope", startDate: new Date().toISOString() })).status, 403);
    assert.equal((await call(app, "GET", "/events?upcoming=true", studentToken)).body.data.length, 1);

    const pass = await call(app, "POST", "/leave-passes", teacher, { studentId: student.id, reason: "Family event", startDate: today, endDate: today });
    assert.equal(pass.status, 201);
    assert.equal(pass.body.data.status, "PENDING");
    assert.equal((await call(app, "PATCH", `/leave-passes/${pass.body.data.id}`, teacher, { status: "APPROVED" })).status, 403);
    assert.equal((await call(app, "PATCH", `/leave-passes/${pass.body.data.id}`, owner, { status: "APPROVED" })).status, 200);

    const staffLeave = await call(app, "POST", "/staff-leave", teacher, { reason: "Training", startDate: today, endDate: today });
    assert.equal(staffLeave.status, 201);
    assert.equal((await call(app, "PATCH", `/staff-leave/${staffLeave.body.data.id}/review`, owner, { status: "APPROVED" })).status, 200);
  });

  await t.test("dashboards return data for each role", async () => {
    const admin = await call(app, "GET", "/dashboard/admin", owner);
    assert.equal(admin.status, 200, JSON.stringify(admin.body));
    assert.equal(admin.body.data.stats.students, 2);

    const teacherDash = await call(app, "GET", "/dashboard/teacher", teacher);
    assert.equal(teacherDash.status, 200, JSON.stringify(teacherDash.body));
    assert.equal(teacherDash.body.data.stats.students, 2);
    assert.equal(teacherDash.body.data.homeroom.className, "Primary 4");

    const studentDash = await call(app, "GET", "/dashboard/student", studentToken);
    assert.equal(studentDash.status, 200, JSON.stringify(studentDash.body));
    assert.equal(studentDash.body.data.student.className, "Primary 4");

    assert.equal((await call(app, "GET", "/dashboard/admin", teacher)).status, 403);
    assert.equal((await call(app, "GET", "/dashboard/teacher", studentToken)).status, 403);
  });

  await t.test("family access: a parent sees only their own child, including finance", async () => {
    const guardianId = student.guardianId as string;
    const account = await call(app, "POST", `/guardians/${guardianId}/portal-account`, owner);
    assert.equal(account.status, 201, JSON.stringify(account.body));
    const parent = await activate(app, guardianEmail, account.body.data.temporaryPassword);

    const children = await call(app, "GET", "/parent/children", parent);
    assert.equal(children.body.data.length, 1);
    assert.equal(children.body.data[0].id, student.id);

    const students = await call(app, "GET", "/students", parent);
    assert.deepEqual(students.body.data.map((s: { id: string }) => s.id), [student.id]);

    const guardians = await call(app, "GET", "/guardians", parent);
    assert.equal(guardians.body.data.length, 1, "a parent never receives the school's guardian directory");

    // Invoices: one for each child; the parent may see only their own.
    const term = (await call(app, "GET", "/academic-status", owner)).body.data.currentTerm;
    for (const child of [student, stranger.body.data]) {
      await call(app, "POST", "/invoices", owner, { studentId: child.id, termId: term.id, dueDate: today, description: "Tuition", amount: 50000 });
    }
    const invoices = await call(app, "GET", "/invoices", parent);
    assert.equal(invoices.status, 200);
    assert.deepEqual(invoices.body.data.map((i: { studentId: string }) => i.studentId), [student.id]);

    const ownFees = await call(app, "GET", "/student/fees", studentToken);
    assert.equal(ownFees.body.data.length, 1);

    const otherChild = await call(app, "GET", `/parent/children/${stranger.body.data.id}/summary`, parent);
    assert.equal(otherChild.status, 404);
    assert.equal((await call(app, "GET", "/parent/children", studentToken)).status, 403);
  });
});
