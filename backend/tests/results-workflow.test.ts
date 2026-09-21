import assert from "node:assert/strict";
import test from "node:test";

import { pool } from "../src/db/pool";
import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

type App = ReturnType<typeof buildTestApp>;
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function call(app: App, method: Method, url: string, token: string, payload?: unknown) {
  const response = await app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
    payload: payload as never,
  });
  return { status: response.statusCode, body: response.json() as { data?: any; message?: string } };
}

/** Creates a staff member and completes the forced first-login password change, returning a usable token. */
async function onboard(app: App, ownerToken: string, email: string, role: "teacher" | "admin", firstName: string) {
  const created = await call(app, "POST", "/staff", ownerToken, { firstName, lastName: "Tester", email, role, phone: "08000000000" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password: created.body.data.temporaryPassword } });
  const changed = await app.inject({
    method: "POST",
    url: "/api/v1/auth/force-update-password",
    headers: { authorization: `Bearer ${login.json().data.token}` },
    payload: { newPassword: "Onboarded12345" },
  });
  return { id: created.body.data.userId as string, token: changed.json().data.token as string };
}

test("results workflow: scheme → scores → class teacher → admin approval → release", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const school = await registerTestSchool(app, suffix);
  const emails: string[] = [];

  t.after(async () => {
    await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [emails]);
    await app.close();
    await closeTestPool();
  });

  const owner = school.token;
  const mail = (name: string) => {
    const email = `${name}+${suffix}@backend-tests.local`;
    emails.push(email);
    return email;
  };

  const status = (await call(app, "GET", "/academic-status", owner)).body.data;
  const termId = status.currentTerm.id as string;
  const sessionId = status.currentSession.id as string;

  const cls = (await call(app, "POST", "/classes", owner, { name: "JSS 2", gradeLevel: "JSS 2", level: 8 })).body.data;
  const arm = (await call(app, "POST", "/class-arms", owner, { classId: cls.id, name: "A" })).body.data.arms[0];
  const math = (await call(app, "POST", "/subjects", owner, { name: "Mathematics", code: "MTH" })).body.data;
  const english = (await call(app, "POST", "/subjects", owner, { name: "English", code: "ENG" })).body.data;

  const mathTeacher = await onboard(app, owner, mail("math"), "teacher", "Mary");
  const classTeacher = await onboard(app, owner, mail("homeroom"), "teacher", "Hilda");

  const students: Array<{ id: string; email: string }> = [];
  for (const [first, last] of [["Ada", "Okafor"], ["Bayo", "Adeyemi"], ["Chi", "Eze"]]) {
    const created = await call(app, "POST", "/students", owner, { firstName: first, lastName: last, gender: "male", classId: cls.id, armId: arm.id });
    assert.equal(created.status, 201);
    students.push({ id: created.body.data.id, email: created.body.data.credentials.email });
    emails.push(created.body.data.credentials.email);
  }

  await call(app, "POST", "/teacher-assignments", owner, { teacherId: mathTeacher.id, classId: cls.id, armId: arm.id, subjectId: math.id });
  await call(app, "POST", "/teacher-assignments", owner, { teacherId: classTeacher.id, classId: cls.id, armId: arm.id, subjectId: english.id });

  const scope = { classId: cls.id, armId: arm.id, subjectId: math.id, termId, sessionId };

  await t.test("the CA scheme must total exactly 100", async () => {
    const bad = await call(app, "POST", "/results/ca-scheme", mathTeacher.token, {
      ...scope,
      components: [{ name: "CA 1", maxScore: 20 }, { name: "CA 2", maxScore: 20 }],
      examMaxScore: 50,
    });
    assert.equal(bad.status, 400);

    const good = await call(app, "POST", "/results/ca-scheme", mathTeacher.token, {
      ...scope,
      components: [{ name: "CA 1", maxScore: 20 }, { name: "CA 2", maxScore: 20 }],
      examMaxScore: 60,
    });
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.deepEqual(good.body.data.components.map((c: { key: string }) => c.key), ["ca1", "ca2"]);
  });

  await t.test("a teacher not assigned to the subject is refused", async () => {
    const attempt = await call(app, "POST", "/results/ca-scheme", classTeacher.token, {
      ...scope,
      components: [{ name: "CA 1", maxScore: 40 }],
      examMaxScore: 60,
    });
    assert.equal(attempt.status, 403);
  });

  await t.test("partial scores save, but out-of-range or foreign students are rejected", async () => {
    const outOfRange = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [{ studentId: students[0].id, caComponents: { ca1: 25 }, examScore: null }],
    });
    assert.equal(outOfRange.status, 400);

    const foreign = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [{ studentId: "00000000-0000-4000-8000-000000000000", caComponents: { ca1: 10 }, examScore: 40 }],
    });
    assert.equal(foreign.status, 400);

    const partial = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [{ studentId: students[0].id, caComponents: { ca1: 18 }, examScore: null }],
    });
    assert.equal(partial.status, 200);

    const sheet = await call(app, "GET", `/results/entry-sheet?classId=${cls.id}&armId=${arm.id}&subjectId=${math.id}&termId=${termId}&sessionId=${sessionId}`, mathTeacher.token);
    const row = sheet.body.data.students.find((s: { studentId: string }) => s.studentId === students[0].id);
    assert.equal(row.scoresComplete, false);
    assert.equal(row.computedTotal, null);
  });

  await t.test("publishing needs a class teacher and every student's scores", async () => {
    const noHomeroom = await call(app, "POST", "/results/publish-to-class-teacher", mathTeacher.token, scope);
    assert.equal(noHomeroom.status, 400);
    assert.match(noHomeroom.body.message ?? "", /class teacher/i);

    const assign = await call(app, "PATCH", `/class-arms/${arm.id}/class-teacher`, owner, { teacherId: classTeacher.id });
    assert.equal(assign.status, 200);

    // Only one student has (partial) scores so far; the other two have no entry at all.
    const blocked = await call(app, "POST", "/results/publish-to-class-teacher", mathTeacher.token, scope);
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.message ?? "", /3 student\(s\) are still missing/);

    const saved = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [
        { studentId: students[0].id, caComponents: { ca1: 18, ca2: 17 }, examScore: 52 },
        { studentId: students[1].id, caComponents: { ca1: 10, ca2: 12 }, examScore: 30 },
        { studentId: students[2].id, caComponents: { ca1: 15, ca2: 15 }, examScore: 45 },
      ],
    });
    assert.equal(saved.status, 200);
  });

  await t.test("the class teacher receives the subject and reviews it", async () => {
    const published = await call(app, "POST", "/results/publish-to-class-teacher", mathTeacher.token, scope);
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.data.status, "PUBLISHED_TO_CLASS_TEACHER");

    const overview = await call(app, "GET", `/results/class-teacher-overview?termId=${termId}&sessionId=${sessionId}`, classTeacher.token);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.data.batches.length, 1);
    assert.equal(overview.body.data.classSummary[0].position, 1);
    assert.equal(overview.body.data.classSummary[0].grandTotal, 87);
    // English is assigned to this class but nobody entered scores: the class teacher cannot submit yet.
    assert.equal(overview.body.data.stats.canSubmitToAdmin, false);
    assert.equal(overview.body.data.notStarted.length, 1);

    const notClassTeacher = await call(app, "GET", `/results/class-teacher-overview?termId=${termId}`, mathTeacher.token);
    assert.equal(notClassTeacher.status, 403);
  });

  await t.test("the class teacher can return a subject; editing after publish flags the batch and audits the change", async () => {
    const edit = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [{ studentId: students[1].id, caComponents: { ca1: 11, ca2: 12 }, examScore: 31 }],
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.data.status, "NEEDS_REPUBLISH");

    const overview = await call(app, "GET", `/results/class-teacher-overview?termId=${termId}&sessionId=${sessionId}`, classTeacher.token);
    assert.equal(overview.body.data.editAudits.length, 1);

    const republish = await call(app, "POST", "/results/publish-to-class-teacher", mathTeacher.token, scope);
    assert.equal(republish.status, 200);

    const sent = await call(app, "POST", "/results/class-teacher-return", classTeacher.token, {
      subjectId: math.id,
      termId,
      reviewNotes: "Please double check Bayo's exam mark.",
    });
    assert.equal(sent.status, 200);

    const fix = await call(app, "POST", "/results/publish-to-class-teacher", mathTeacher.token, scope);
    assert.equal(fix.status, 200);
  });

  await t.test("English scores are entered so the class can be submitted", async () => {
    const teacherlessScope = { ...scope, subjectId: english.id };
    const scheme = await call(app, "POST", "/results/ca-scheme", classTeacher.token, {
      ...teacherlessScope,
      components: [{ name: "Test", maxScore: 40 }],
      examMaxScore: 60,
    });
    assert.equal(scheme.status, 200, JSON.stringify(scheme.body));
    await call(app, "POST", "/results/scores", classTeacher.token, {
      ...teacherlessScope,
      scores: students.map((s, i) => ({ studentId: s.id, caComponents: { ca1: 30 - i * 5 }, examScore: 50 - i * 5 })),
    });
    const published = await call(app, "POST", "/results/publish-to-class-teacher", classTeacher.token, teacherlessScope);
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const submit = await call(app, "POST", "/results/class-teacher-publish", classTeacher.token, {
      termId,
      sessionId,
      teacherRemark: "A hard-working class.",
    });
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    assert.equal(submit.body.data.submittedSubjects, 2);
  });

  await t.test("submitted scores are locked against further edits", async () => {
    const locked = await call(app, "POST", "/results/scores", mathTeacher.token, {
      ...scope,
      scores: [{ studentId: students[2].id, caComponents: { ca1: 20, ca2: 20 }, examScore: 60 }],
    });
    assert.equal(locked.status, 409);
  });

  await t.test("only administrators reach the approval queue", async () => {
    const asTeacher = await call(app, "GET", "/results/approval-queue", mathTeacher.token);
    assert.equal(asTeacher.status, 403);

    const queue = await call(app, "GET", `/results/approval-queue?termId=${termId}&status=pending`, owner);
    assert.equal(queue.status, 200);
    assert.equal(queue.body.data.length, 2);
  });

  await t.test("release is refused until every subject is approved", async () => {
    const early = await call(app, "POST", "/results/approval-queue/publish-class", owner, { classId: cls.id, armId: arm.id, termId, sessionId });
    assert.equal(early.status, 400);

    const queue = (await call(app, "GET", `/results/approval-queue?termId=${termId}&status=pending`, owner)).body.data;
    const [first, second] = queue;

    const returned = await call(app, "POST", `/results/approval-queue/${first.id}/return`, owner, { reviewNotes: "Recheck CA totals." });
    assert.equal(returned.status, 200);
    const cannotApprove = await call(app, "POST", `/results/approval-queue/${first.id}/approve`, owner);
    assert.equal(cannotApprove.status, 409, "a returned subject is not pending review any more");
    await call(app, "POST", `/results/approval-queue/${second.id}/approve`, owner);
  });

  await t.test("after correction and approval the class is released", async () => {
    const queue = (await call(app, "GET", `/results/approval-queue?termId=${termId}`, owner)).body.data;
    const returned = queue.find((row: { status: string }) => row.status === "RETURNED_FOR_CORRECTION");
    assert.ok(returned);

    // The subject teacher (or class teacher for English) fixes and republishes, then the class teacher resubmits.
    const teacherToken = returned.subjectId === math.id ? mathTeacher.token : classTeacher.token;
    const republish = await call(app, "POST", "/results/publish-to-class-teacher", teacherToken, {
      classId: cls.id,
      armId: arm.id,
      subjectId: returned.subjectId,
      termId,
      sessionId,
    });
    assert.equal(republish.status, 200, JSON.stringify(republish.body));
    const resubmit = await call(app, "POST", "/results/class-teacher-publish", classTeacher.token, { termId, sessionId });
    assert.equal(resubmit.status, 200, JSON.stringify(resubmit.body));

    const pending = (await call(app, "GET", `/results/approval-queue?termId=${termId}&status=pending`, owner)).body.data;
    assert.equal(pending.length, 1);
    await call(app, "POST", `/results/approval-queue/${pending[0].id}/approve`, owner);

    const readiness = await call(app, "GET", `/results/approval-queue/publish-readiness?classId=${cls.id}&armId=${arm.id}&termId=${termId}&sessionId=${sessionId}`, owner);
    assert.equal(readiness.body.data.canPublish, true);

    // Before release a student sees nothing, even by asking for their own result directly.
    const studentPassword = await resetAndLogin(app, owner, students[0]);
    const before = await call(app, "GET", `/results/my?termId=${termId}`, studentPassword);
    assert.equal(before.status, 200);
    assert.deepEqual(before.body.data, []);

    const released = await call(app, "POST", "/results/approval-queue/publish-class", owner, {
      classId: cls.id,
      armId: arm.id,
      termId,
      sessionId,
      principalRemark: "Well done.",
    });
    assert.equal(released.status, 200, JSON.stringify(released.body));
    assert.equal(released.body.data.publishedCount, 3);

    const mine = await call(app, "GET", `/results/my?termId=${termId}`, studentPassword);
    assert.equal(mine.body.data.length, 1);
    assert.equal(mine.body.data[0].subjects.length, 2);
    assert.equal(mine.body.data[0].position, 1);
    assert.equal(mine.body.data[0].classSize, 3);

    const otherStudent = await call(app, "GET", `/results/published/${students[1].id}?termId=${termId}`, studentPassword);
    assert.equal(otherStudent.status, 404, "a student cannot read a classmate's result");

    const card = await call(app, "GET", `/results/report-card?termId=${termId}`, studentPassword);
    assert.equal(card.status, 200, JSON.stringify(card.body));
    assert.equal(card.body.data.position, 1);
    assert.equal(card.body.data.principalRemark, "Well done.");
    assert.equal(card.body.data.passedSubjects, 2);

    const again = await call(app, "POST", "/results/approval-queue/publish-class", owner, { classId: cls.id, armId: arm.id, termId, sessionId });
    assert.equal(again.status, 409);
  });
});

async function resetAndLogin(app: App, ownerToken: string, student: { id: string; email: string }): Promise<string> {
  const reset = await call(app, "POST", `/students/${student.id}/reset-password`, ownerToken);
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: student.email, password: reset.body.data.temporaryPassword } });
  const changed = await app.inject({
    method: "POST",
    url: "/api/v1/auth/force-update-password",
    headers: { authorization: `Bearer ${login.json().data.token}` },
    payload: { newPassword: "StudentPass12345" },
  });
  return changed.json().data.token as string;
}
