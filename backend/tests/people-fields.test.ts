import assert from "node:assert/strict";
import test from "node:test";
import { defaults, PeopleField, resolveFields, validatePeopleFields } from "../src/modules/school-settings/people-fields";
import { parseCsv } from "../src/modules/school-settings/people-import.routes";
import { pool } from "../src/db/pool";
import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

const custom = (key: string, type: PeopleField["type"] = "text", required = true): PeopleField => ({ key, label: key, type, required, enabled: true, aliases: [], options: type === "select" ? ["Red", "Blue"] : [] });

test("CSV parsing and field configuration validation", () => {
  assert.deepEqual(parseCsv('\uFEFFFirst,Note\r\nAda,"Hello, ""friend""\nLine 2"\r\n'), [["First", "Note"], ["Ada", 'Hello, "friend"\nLine 2']]);
  for (const csv of ['a,b\n"unclosed,b', 'a,b\n"closed"junk,b', 'a,b\nhel"lo,b', "a,b", "a\n" + Array(301).fill("b").join("\n")]) assert.throws(() => parseCsv(csv));
  assert.throws(() => resolveFields("student", [custom("constructor")]));
  assert.throws(() => resolveFields("student", [custom("role")]));
  assert.throws(() => resolveFields("student", [custom("x"), custom("x")]));
  assert.throws(() => resolveFields("student", [{ ...defaults.student[0], enabled: false }]));
  assert.throws(() => resolveFields("student", [{ ...defaults.student[0], required: false }]));
  assert.throws(() => resolveFields("student", [{ ...custom("x"), aliases: ["First name"] }]));
  assert.throws(() => resolveFields("teacher", [{ ...custom("x"), type: "select", options: [] }]));
  assert.throws(() => resolveFields("teacher", [{ ...defaults.teacher[0], type: "number" }]));
  const fields = [custom("birth", "date"), custom("count", "number"), custom("contact", "email"), custom("house", "select")];
  const data = { customFields: { birth: "2024-02-29", count: 0, contact: "a@example.com", house: "Red" } };
  validatePeopleFields("student", fields, data);
  for (const patch of [{ birth: "2025-02-29" }, { count: "abc" }, { contact: "bad" }, { house: "Green" }, { house: "" }, { unknown: "value" }]) assert.throws(() => validatePeopleFields("student", fields, { customFields: { ...data.customFields, ...patch } }));
});

test("school-specific student and teacher fields, imports, persistence and tenant permissions", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const schools: Awaited<ReturnType<typeof registerTestSchool>>[] = [];
  const emails: string[] = [];
  const call = async (token: string, method: "GET" | "POST" | "PATCH", path: string, payload?: any) => {
    const response = await app.inject({ method, url: `/api/v1${path}`, headers: { authorization: `Bearer ${token}` }, payload });
    return { status: response.statusCode, data: response.json().data, body: response.json() };
  };
  t.after(async () => {
    for (const school of schools) await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await pool.query("DELETE FROM profiles WHERE email = ANY($1)", [emails]);
    await app.close(); await closeTestPool();
  });
  const a = await registerTestSchool(app, `${suffix}a`); schools.push(a);
  const b = await registerTestSchool(app, `${suffix}b`); schools.push(b);
  assert.equal(a.response.statusCode, 201); assert.equal(b.response.statusCode, 201);
  const classA = await call(a.token, "POST", "/classes", { name: "Year 1", gradeLevel: "Year 1" });
  const classB = await call(b.token, "POST", "/classes", { name: "Year 1", gradeLevel: "Year 1" });
  assert.equal(classA.status, 201); assert.equal(classB.status, 201);
  const config = await call(a.token, "GET", "/school-settings");
  let studentFields: PeopleField[] = config.data.studentFields.map((f: PeopleField) => ({ ...f, label: f.key === "firstName" ? "Learner name" : f.key === "lastName" ? "Family name" : f.key === "classId" ? "Grade" : f.label }));
  studentFields.push({ ...custom("rollCode"), label: "Roll code", aliases: ["Roll"] }, { ...custom("house", "select"), label: "House" }, { ...custom("locker", "number", false), label: "Locker" });
  const teacherFields = [...config.data.teacherFields.map((f: PeopleField) => ({ ...f, aliases: f.key === "firstName" ? ["Given names"] : f.aliases })), { ...custom("license"), label: "Teaching license", aliases: ["TRCN"] }];

  await t.test("settings persist only for the authenticated school and reject invalid definitions", async () => {
    assert.equal((await call(a.token, "PATCH", "/school-settings", { studentFields, teacherFields, schoolId: b.schoolId })).status, 200);
    const own = await call(a.token, "GET", "/school-settings");
    assert.equal(own.data.studentFields.find((f: PeopleField) => f.key === "firstName").label, "Learner name");
    const other = await call(b.token, "GET", "/school-settings");
    assert.ok(!other.data.studentFields.some((f: PeopleField) => f.key === "rollCode"));
    assert.equal((await call(a.token, "PATCH", "/school-settings", { studentFields: [{ ...studentFields[0], enabled: false }] })).status, 400);
    assert.equal((await call(a.token, "PATCH", "/school-settings", { teacherFields: [custom("role")] })).status, 400);
    assert.equal((await call(a.token, "PATCH", "/school-settings", { studentFields: [{ ...custom("test"), aliases: ["Grade"] }, ...studentFields] })).status, 400);
  });
  let importedStudent: any;
  const csv = 'Learner name,Family name,Sex,Grade,Roll,House,Locker\r\nAda,Okafor,F,Year 1,R001,red,0';
  await t.test("student preview maps renamed headers and aliases without database writes", async () => {
    const preview = await call(a.token, "POST", "/students/import/preview", { csv });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.deepEqual(preview.data.errors, []); assert.deepEqual(preview.data.rows[0].errors, []);
    assert.equal(preview.data.rows[0].data.classId, classA.data.id);
    assert.equal(preview.data.rows[0].data.gender, "female");
    assert.deepEqual(preview.data.rows[0].data.customFields, { rollCode: "R001", house: "Red", locker: 0 });
    assert.equal((await call(a.token, "GET", "/students")).data.length, 0);
    assert.equal((await call(a.token, "POST", "/students/import", { csv })).status, 400);
    const saved = await call(a.token, "POST", "/students/import", { csv, previewToken: preview.data.previewToken });
    assert.equal(saved.status, 201, JSON.stringify(saved.body)); assert.equal(saved.data.success.length, 1);
    importedStudent = saved.data.success[0].record;
    emails.push(saved.data.success[0].credentials.email);
    assert.deepEqual(importedStudent.customFields, { rollCode: "R001", house: "Red", locker: 0 });
    const read = await call(a.token, "GET", `/students/${importedStudent.id}`);
    assert.deepEqual(read.data.customFields, importedStudent.customFields);
    assert.equal((await call(b.token, "GET", `/students/${importedStudent.id}`)).status, 404);
    assert.equal((await call(a.token, "PATCH", `/students/${importedStudent.id}`, { customFields: { rollCode: "" } })).status, 400);
    assert.equal((await call(a.token, "PATCH", `/students/${importedStudent.id}`, { customFields: { locker: 7 } })).status, 200);
    assert.equal((await call(a.token, "GET", `/students/${importedStudent.id}`)).data.customFields.rollCode, "R001");
  });
  await t.test("CSV validation blocks unknown, duplicate, missing, malformed and foreign data", async () => {
    for (const bad of [csv.replace("Roll,", "Unknown,"), csv.replace("Roll,", "firstName,"), csv.replace(",F,", ",invalid,"), csv.replace(",red,", ",Green,"), csv.replace(",R001,", ",,"), csv.replace("Year 1,R001", `${classB.data.id},R001`), csv.replace(",0", ",oops"), csv + ",extra"]) {
      const preview = await call(a.token, "POST", "/students/import/preview", { csv: bad });
      assert.equal(preview.status, 200); assert.ok(preview.data.errors.length || preview.data.rows.some((r: any) => r.errors.length), bad);
      assert.equal((await call(a.token, "POST", "/students/import", { csv: bad, previewToken: preview.data.previewToken })).status, 400);
    }
    assert.equal((await call(a.token, "POST", "/students/import/preview", { csv: 'a,b\n"broken,b' })).status, 400);
    assert.equal((await call(a.token, "GET", "/students")).data.length, 1);
  });
  await t.test("settings changes invalidate a previously valid preview", async () => {
    const preview = await call(a.token, "POST", "/students/import/preview", { csv });
    studentFields = studentFields.map((f) => f.key === "rollCode" ? { ...f, aliases: [...f.aliases, "Registry"] } : f);
    assert.equal((await call(a.token, "PATCH", "/school-settings", { studentFields })).status, 200);
    assert.equal((await call(a.token, "POST", "/students/import", { csv, previewToken: preview.data.previewToken })).status, 400);
  });
  await t.test("manual and legacy bulk student endpoints enforce school custom fields", async () => {
    const body = { firstName: "Manual", lastName: "Pupil", gender: "male", classId: classA.data.id, createLogin: false };
    assert.equal((await call(a.token, "POST", "/students", body)).status, 400);
    const valid = await call(a.token, "POST", "/students", { ...body, customFields: { rollCode: "R002", house: "Blue" } });
    assert.equal(valid.status, 201); assert.equal(valid.data.customFields.rollCode, "R002");
    const bulk = await call(a.token, "POST", "/students/bulk-import", { students: [{ ...body, admissionNumber: "BULK-01" }] });
    assert.equal(bulk.data.success.length, 0); assert.equal(bulk.data.failed.length, 1);
    assert.equal((await call(b.token, "POST", "/students", { ...body, classId: classB.data.id })).status, 201);
  });
  let teacher: any;
  await t.test("teacher import previews aliases, persists custom fields and returns credentials", async () => {
    const email = `import-teacher+${suffix}@backend-tests.local`; emails.push(email);
    const csv = `Given names,Surname,Email,TRCN\nGrace,Hopper,${email},TRCN-42`;
    const preview = await call(a.token, "POST", "/staff/import/preview", { csv });
    assert.equal(preview.status, 200); assert.deepEqual(preview.data.rows[0].errors, []);
    assert.equal((await call(a.token, "GET", "/staff")).data.length, 0);
    const saved = await call(a.token, "POST", "/staff/import", { csv, previewToken: preview.data.previewToken });
    assert.equal(saved.status, 201); assert.equal(saved.data.success.length, 1, JSON.stringify(saved.body));
    teacher = saved.data.success[0];
    assert.equal(teacher.record.role, "teacher"); assert.equal(teacher.record.customFields.license, "TRCN-42");
    assert.ok(teacher.credentials.temporaryPassword);
    assert.equal((await call(b.token, "GET", `/staff/${teacher.record.userId}`)).status, 404);
    assert.equal((await call(a.token, "PATCH", `/staff/${teacher.record.userId}`, { customFields: { license: "" } })).status, 400);
    const duplicate = await call(a.token, "POST", "/staff/import/preview", { csv: csv + `\nOther,Person,${email},TRCN-43` });
    assert.ok(duplicate.data.rows[1].errors.some((e: string) => e.includes("Duplicate")));
  });
  await t.test("manual teachers validate custom fields while other schools keep their own form", async () => {
    const email = `manual-teacher+${suffix}@backend-tests.local`; emails.push(email);
    const body = { firstName: "Mary", lastName: "Jones", email, role: "teacher" };
    assert.equal((await call(a.token, "POST", "/staff", body)).status, 400);
    assert.equal((await call(a.token, "POST", "/staff", { ...body, customFields: { license: "TRCN-50" } })).status, 201);
    const otherEmail = `other-teacher+${suffix}@backend-tests.local`; emails.push(otherEmail);
    assert.equal((await call(b.token, "POST", "/staff", { ...body, email: otherEmail })).status, 201);
  });
  await t.test("teachers cannot change field settings or import either person type", async () => {
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: teacher.credentials.email, password: teacher.credentials.temporaryPassword } });
    const change = await call(login.json().data.token, "POST", "/auth/force-update-password", { newPassword: "ChangedPassword123" });
    assert.equal(change.status, 200);
    const token = change.data.token;
    assert.equal((await call(token, "PATCH", "/school-settings", { studentFields: [] })).status, 403);
    for (const path of ["/students/import/preview", "/students/import", "/staff/import/preview", "/staff/import"]) assert.equal((await call(token, "POST", path, { csv })).status, 403);
  });
});
