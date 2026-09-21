import assert from "node:assert/strict";
import test from "node:test";

import { pool } from "../src/db/pool";
import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function expectStatus(pending: Promise<{ status: number }>, expected: number) {
  const result = await pending;
  assert.equal(result.status, expected, `unexpected status (see the request in this call site)`);
}

test("portal isolation: school B can neither read nor change school A's records through any new module", async (t) => {
  const app = buildTestApp();
  const a = await registerTestSchool(app, uniqueSuffix());
  const b = await registerTestSchool(app, uniqueSuffix());
  const extra: string[] = [];

  t.after(async () => {
    await cleanupTestSchool(a.schoolId, a.ownerEmail, a.schoolEmail);
    await cleanupTestSchool(b.schoolId, b.ownerEmail, b.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [extra]);
    await app.close();
    await closeTestPool();
  });

  const call = async (method: Method, url: string, token: string, payload?: unknown) => {
    const response = await app.inject({ method, url: `/api/v1${url}`, headers: { authorization: `Bearer ${token}` }, payload: payload as never });
    return { status: response.statusCode, body: response.json() as { data?: any } };
  };

  // --- School A builds a small world.
  const aStatus = (await call("GET", "/academic-status", a.token)).body.data;
  const aClass = (await call("POST", "/classes", a.token, { name: "JSS 1", gradeLevel: "JSS 1" })).body.data;
  const aArm = (await call("POST", "/class-arms", a.token, { classId: aClass.id, name: "A" })).body.data.arms[0];
  const aSubject = (await call("POST", "/subjects", a.token, { name: "Mathematics", code: "MTH" })).body.data;
  const aStudent = (await call("POST", "/students", a.token, { firstName: "Ada", lastName: "Ola", gender: "female", classId: aClass.id, armId: aArm.id })).body.data;
  extra.push(aStudent.credentials.email);
  const aStaff = (await call("POST", "/staff", a.token, { firstName: "Tee", lastName: "Cher", email: `iso-teacher+${a.schoolId.slice(0, 6)}@backend-tests.local`, role: "teacher", phone: "08000000000" })).body.data;
  extra.push(aStaff.email);
  const aEvent = (await call("POST", "/events", a.token, { title: "Open day", startDate: new Date(Date.now() + 86_400_000).toISOString() })).body.data;
  const aEntry = (await call("POST", "/timetable", a.token, { classId: aClass.id, subjectId: aSubject.id, dayOfWeek: 1, startTime: "08:00", endTime: "09:00" })).body.data;
  const aHomework = (await call("POST", "/assignments", a.token, { classId: aClass.id, title: "Sums" })).body.data;
  const aPass = (await call("POST", "/leave-passes", a.token, { studentId: aStudent.id, reason: "Family", startDate: "2026-01-01", endDate: "2026-01-02" })).body.data;
  assert.ok(aStatus && aClass && aStudent && aEvent && aEntry && aHomework && aPass);

  // --- School B has its own class/subject, and tries to reach across.
  const bClass = (await call("POST", "/classes", b.token, { name: "JSS 1", gradeLevel: "JSS 1" })).body.data;
  const bSubject = (await call("POST", "/subjects", b.token, { name: "Mathematics", code: "MTH" })).body.data;

  await t.test("reading A's records by id returns nothing", async () => {
    await expectStatus(call("GET", `/students/${aStudent.id}`, b.token), 404);
    await expectStatus(call("GET", `/students/${aStudent.id}/academic-summary`, b.token), 404);
    await expectStatus(call("GET", `/staff/${aStaff.userId}`, b.token), 404);
    await expectStatus(call("GET", `/staff/${aStaff.userId}/schedule`, b.token), 404);
    await expectStatus(call("GET", `/assignments/${aHomework.id}/submissions`, b.token), 404);
    for (const path of ["/students", "/staff", "/classes", "/timetable", "/events", "/assignments", "/leave-passes", "/teacher-assignments"]) {
      const listed = JSON.stringify((await call("GET", path, b.token)).body.data ?? []);
      assert.ok(!listed.includes(aStudent.id) && !listed.includes(aClass.id) && !listed.includes(aEvent.id) && !listed.includes(aEntry.id), `${path} leaked school A data`);
    }
  });

  await t.test("changing A's records by id is refused", async () => {
    await expectStatus(call("PATCH", `/students/${aStudent.id}`, b.token, { firstName: "Hijacked" }), 404);
    await expectStatus(call("POST", `/students/${aStudent.id}/reset-password`, b.token), 404);
    await expectStatus(call("PATCH", `/staff/${aStaff.userId}/toggle`, b.token), 404);
    await expectStatus(call("POST", `/staff/${aStaff.userId}/reset-password`, b.token), 404);
    await expectStatus(call("DELETE", `/staff/${aStaff.userId}`, b.token), 404);
    await expectStatus(call("DELETE", `/events/${aEvent.id}`, b.token), 404);
    await expectStatus(call("DELETE", `/timetable/${aEntry.id}`, b.token), 404);
    await expectStatus(call("DELETE", `/assignments/${aHomework.id}`, b.token), 404);
    await expectStatus(call("PATCH", `/leave-passes/${aPass.id}`, b.token, { status: "APPROVED" }), 404);
    await expectStatus(call("PATCH", `/class-arms/${aArm.id}/class-teacher`, b.token, { teacherId: aStaff.userId }), 404);
    await expectStatus(call("DELETE", `/class-arms/${aArm.id}`, b.token), 404);
    await expectStatus(call("PATCH", `/terms/${aStatus.currentTerm.id}/deactivate`, b.token), 404);
    await expectStatus(call("PATCH", `/academic-sessions/${aStatus.currentSession.id}/set-current`, b.token), 404);
  });

  await t.test("B cannot point its own records at A's rows", async () => {
    // A's teacher into B's class, A's class into B's timetable/homework/results.
    await expectStatus(call("POST", "/teacher-assignments", b.token, { teacherId: aStaff.userId, classId: bClass.id, subjectId: bSubject.id }), 404);
    await expectStatus(call("POST", "/timetable", b.token, { classId: aClass.id, dayOfWeek: 2, startTime: "08:00", endTime: "09:00" }), 404);
    await expectStatus(call("POST", "/timetable", b.token, { classId: bClass.id, subjectId: aSubject.id, dayOfWeek: 2, startTime: "08:00", endTime: "09:00" }), 404);
    await expectStatus(call("POST", "/assignments", b.token, { classId: aClass.id, title: "Nope" }), 404);
    await expectStatus(call("POST", "/students", b.token, { firstName: "X", lastName: "Y", gender: "male", classId: aClass.id }), 404);
    await expectStatus(call("POST", "/results/ca-scheme", b.token, { classId: aClass.id, armId: aArm.id, subjectId: aSubject.id, termId: aStatus.currentTerm.id, sessionId: aStatus.currentSession.id, components: [{ name: "CA", maxScore: 40 }], examMaxScore: 60 }), 404);
    await expectStatus(call("POST", "/results/scores", b.token, { classId: bClass.id, subjectId: bSubject.id, termId: aStatus.currentTerm.id, sessionId: aStatus.currentSession.id, scores: [{ studentId: aStudent.id, caComponents: {}, examScore: null }] }), 400);
    await expectStatus(call("POST", "/messages", b.token, { recipientId: aStaff.userId, body: "hello" }), 404);
    await expectStatus(call("POST", "/leave-passes", b.token, { studentId: aStudent.id, reason: "Not allowed", startDate: "2026-01-01", endDate: "2026-01-01" }), 404);
    await expectStatus(call("POST", "/staff-attendance/mark", b.token, { staffUserId: aStaff.userId, attendanceDate: "2026-01-01", status: "ABSENT" }), 404);
    await expectStatus(call("POST", "/messages/broadcast", b.token, { classId: aClass.id, body: "hello all" }), 404);
  });

  await t.test("A's data is untouched", async () => {
    const student = await call("GET", `/students/${aStudent.id}`, a.token);
    assert.equal(student.body.data.firstName, "Ada");
    assert.equal((await call("GET", `/staff/${aStaff.userId}`, a.token)).body.data.isActive, true);
    assert.equal((await call("GET", "/events", a.token)).body.data.length, 1);
  });
});
