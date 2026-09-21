import assert from "node:assert/strict";
import test from "node:test";

import { pool } from "../src/db/pool";
import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

type App = ReturnType<typeof buildTestApp>;

async function call(app: App, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, token: string, payload?: unknown) {
  const response = await app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
    payload: payload as never,
  });
  return { status: response.statusCode, body: response.json() as { data?: any; message?: string } };
}

async function signIn(app: App, email: string, password: string) {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
  return { status: response.statusCode, data: response.json().data };
}

test("school portal core: staff, classes, students, credentials and visibility", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const school = await registerTestSchool(app, suffix);
  const extraEmails: string[] = [];

  t.after(async () => {
    await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [extraEmails]);
    await app.close();
    await closeTestPool();
  });

  const owner = school.token;

  const cls = await call(app, "POST", "/classes", owner, { name: "JSS 1", gradeLevel: "JSS 1", level: 7 });
  assert.equal(cls.status, 201);
  const classId = cls.body.data.id as string;

  const withArm = await call(app, "POST", "/class-arms", owner, { classId, name: "A" });
  assert.equal(withArm.status, 201);
  const armId = withArm.body.data.arms[0].id as string;

  let teacherToken = "";
  let teacherId = "";
  const teacherEmail = `teacher+${suffix}@backend-tests.local`;
  extraEmails.push(teacherEmail);

  await t.test("creating staff issues a temporary password that must be changed before anything else works", async () => {
    const created = await call(app, "POST", "/staff", owner, {
      firstName: "Grace",
      lastName: "Hopper",
      email: teacherEmail,
      role: "teacher",
      phone: "08000000000",
    });
    assert.equal(created.status, 201);
    const temporaryPassword = created.body.data.temporaryPassword as string;
    assert.ok(temporaryPassword && temporaryPassword.length >= 12);
    teacherId = created.body.data.userId;

    const login = await signIn(app, teacherEmail, temporaryPassword);
    assert.equal(login.status, 200);
    assert.equal(login.data.mustChangePassword, true);

    // A temporary-password token can reach nothing but the password change itself.
    const blocked = await call(app, "GET", "/students", login.data.token);
    assert.equal(blocked.status, 403);

    const weak = await app.inject({
      method: "POST",
      url: "/api/v1/auth/force-update-password",
      headers: { authorization: `Bearer ${login.data.token}` },
      payload: { newPassword: "short" },
    });
    assert.equal(weak.statusCode, 400);

    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/force-update-password",
      headers: { authorization: `Bearer ${login.data.token}` },
      payload: { newPassword: "BrandNewPass123" },
    });
    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().data.mustChangePassword, false);
    teacherToken = changed.json().data.token;

    const allowed = await call(app, "GET", "/classes", teacherToken);
    assert.equal(allowed.status, 200);
  });

  let studentEmail = "";
  let studentPassword = "";
  let studentId = "";
  let otherStudentId = "";

  await t.test("enrolling a student generates admission number and login credentials", async () => {
    const created = await call(app, "POST", "/students", owner, {
      firstName: "Ada",
      lastName: "Lovelace",
      gender: "female",
      classId,
      armId,
      guardian: { firstName: "Byron", lastName: "Lovelace", relationship: "father", phone: "08011111111", email: `guardian+${suffix}@backend-tests.local` },
    });
    assert.equal(created.status, 201);
    studentId = created.body.data.id;
    assert.match(created.body.data.admissionNumber, /\/\d{4}\/\d+$/);
    assert.equal(created.body.data.armName, "A");
    studentEmail = created.body.data.credentials.email;
    studentPassword = created.body.data.credentials.temporaryPassword;
    extraEmails.push(studentEmail);
    assert.match(studentEmail, /^ada\.lovelace@/);

    const second = await call(app, "POST", "/students", owner, { firstName: "Alan", lastName: "Turing", gender: "male", classId });
    assert.equal(second.status, 201);
    otherStudentId = second.body.data.id;
    extraEmails.push(second.body.data.credentials.email);
  });

  await t.test("a teacher sees only the classes they are assigned to", async () => {
    const before = await call(app, "GET", "/students", teacherToken);
    assert.equal(before.status, 200);
    assert.equal(before.body.data.length, 0);

    const subject = await call(app, "POST", "/subjects", owner, { name: "Mathematics", code: "MTH" });
    assert.equal(subject.status, 201);
    const assignment = await call(app, "POST", "/teacher-assignments", owner, {
      teacherId,
      classId,
      armId,
      subjectId: subject.body.data.id,
    });
    assert.equal(assignment.status, 201);

    const after = await call(app, "GET", "/students", teacherToken);
    assert.equal(after.body.data.length, 1, "arm A student only — the second student has no arm");
    assert.equal(after.body.data[0].id, studentId);

    const hidden = await call(app, "GET", `/students/${otherStudentId}`, teacherToken);
    assert.equal(hidden.status, 404);
  });

  await t.test("a student signs in, is forced to change password, and can only see themself", async () => {
    const login = await signIn(app, studentEmail, studentPassword);
    assert.equal(login.status, 200);
    assert.equal(login.data.role, "student");
    assert.equal(login.data.mustChangePassword, true);

    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/force-update-password",
      headers: { authorization: `Bearer ${login.data.token}` },
      payload: { newPassword: "StudentPass123" },
    });
    const token = changed.json().data.token as string;

    const list = await call(app, "GET", "/students", token);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((s: { id: string }) => s.id), [studentId]);

    const other = await call(app, "GET", `/students/${otherStudentId}`, token);
    assert.equal(other.status, 404);

    const forbidden = await call(app, "POST", "/students", token, { firstName: "X", lastName: "Y", gender: "male", classId });
    assert.equal(forbidden.status, 403);
  });

  await t.test("refresh tokens rotate and a replayed token revokes the session family", async () => {
    const login = await signIn(app, teacherEmail, "BrandNewPass123");
    assert.equal(login.status, 200);
    const first = login.data.refreshToken as string;

    const rotated = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: first } });
    assert.equal(rotated.statusCode, 200);
    const second = rotated.json().data.refreshToken as string;
    assert.notEqual(second, first);

    const replay = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: first } });
    assert.equal(replay.statusCode, 401);

    const afterTheft = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: second } });
    assert.equal(afterTheft.statusCode, 401, "reuse of a rotated token kills every session of that account");
  });

  await t.test("password reset never reveals whether an e-mail exists", async () => {
    const known = await app.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email: teacherEmail } });
    const unknown = await app.inject({ method: "POST", url: "/api/v1/auth/forgot-password", payload: { email: `nobody+${suffix}@backend-tests.local` } });
    assert.equal(known.statusCode, 200);
    assert.equal(unknown.statusCode, 200);
    assert.deepEqual(known.json(), unknown.json());

    const stored = await pool.query("SELECT token_hash FROM password_resets WHERE user_id = $1", [teacherId]);
    assert.equal(stored.rowCount, 1);
    assert.match(stored.rows[0].token_hash, /^[0-9a-f]{64}$/, "only a hash of the token is stored");
  });

  await t.test("grading scale is validated and drives grade lookup", async () => {
    const list = await call(app, "GET", "/grading-system", owner);
    assert.equal(list.body.data.length, 9);

    const gap = await call(app, "PUT", "/grading-system", owner, {
      bands: [
        { minScore: 0, maxScore: 40, grade: "F", isPass: false },
        { minScore: 60, maxScore: 100, grade: "A", isPass: true },
      ],
    });
    assert.equal(gap.status, 400);

    const preview = await call(app, "GET", "/grading-system/preview?score=76", owner);
    assert.equal(preview.body.data.grade, "A1");
  });

  await t.test("calendar management: only administrators change the current term", async () => {
    const status = await call(app, "GET", "/academic-status", owner);
    assert.equal(status.status, 200);
    const term = status.body.data.terms.find((row: { isCurrent: boolean }) => !row.isCurrent);

    const asTeacher = await call(app, "PATCH", `/terms/${term.id}/set-current`, teacherToken);
    assert.equal(asTeacher.status, 403);

    const asOwner = await call(app, "PATCH", `/terms/${term.id}/set-current`, owner);
    assert.equal(asOwner.status, 200);
    assert.equal(asOwner.body.data.isCurrent, true);
  });
});
