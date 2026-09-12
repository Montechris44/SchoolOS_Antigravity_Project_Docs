import assert from "node:assert/strict";
import test from "node:test";

import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

test("tenant isolation: one school cannot see or touch another school's data", async (t) => {
  const app = buildTestApp();
  const suffixA = uniqueSuffix();
  const suffixB = uniqueSuffix();
  const schoolA = await registerTestSchool(app, suffixA);
  const schoolB = await registerTestSchool(app, suffixB);

  t.after(async () => {
    await cleanupTestSchool(schoolA.schoolId, schoolA.ownerEmail, schoolA.schoolEmail);
    await cleanupTestSchool(schoolB.schoolId, schoolB.ownerEmail, schoolB.schoolEmail);
    await app.close();
    await closeTestPool();
  });

  const classInB = await app.inject({
    method: "POST",
    url: "/api/v1/classes",
    headers: { authorization: `Bearer ${schoolB.token}` },
    payload: { name: "JSS 1 Isolation", gradeLevel: "JSS 1", capacity: 30 },
  });
  assert.equal(classInB.statusCode, 201);
  const classBId = classInB.json().data.id;

  await t.test("school A's class list never includes school B's class", async () => {
    const listAsA = await app.inject({
      method: "GET",
      url: "/api/v1/classes",
      headers: { authorization: `Bearer ${schoolA.token}` },
    });
    assert.equal(listAsA.statusCode, 200);
    const ids = listAsA.json().data.map((c: { id: string }) => c.id);
    assert.ok(!ids.includes(classBId));
  });

  await t.test("school A cannot enroll a student into school B's class", async () => {
    const attempt = await app.inject({
      method: "POST",
      url: "/api/v1/students",
      headers: { authorization: `Bearer ${schoolA.token}` },
      payload: {
        admissionNumber: "CROSS/001",
        firstName: "Cross",
        lastName: "Tenant",
        gender: "male",
        dateOfBirth: "2013-01-01",
        classId: classBId,
      },
    });
    assert.equal(attempt.statusCode, 404);
  });

  await t.test("school A cannot patch school B's settings", async () => {
    const attempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/schools/${schoolB.schoolId}`,
      headers: { authorization: `Bearer ${schoolA.token}` },
      payload: { name: "Hijacked Name" },
    });
    assert.equal(attempt.statusCode, 403);
  });
});
