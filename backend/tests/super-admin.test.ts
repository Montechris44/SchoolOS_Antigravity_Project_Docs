import assert from "node:assert/strict";
import test from "node:test";

import bcrypt from "bcryptjs";

import { pool } from "../src/db/pool";
import {
  buildTestApp,
  cleanupTestSchool,
  closeTestPool,
  registerTestSchool,
  uniqueSuffix,
} from "./helpers";

async function seedTestSuperAdmin(email: string, password: string): Promise<string> {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query<{ id: string }>(
    "INSERT INTO super_admins (email, password_hash, full_name) VALUES ($1, $2, 'Test Super Admin') RETURNING id",
    [email, passwordHash]
  );
  return result.rows[0].id;
}

async function deleteTestSuperAdmin(email: string): Promise<void> {
  await pool.query("DELETE FROM super_admins WHERE email = $1", [email]);
}

test("super admin: separate auth, cross-token isolation, and school suspension", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const superAdminEmail = `sa+${suffix}@backend-tests.local`;
  const superAdminPassword = "SuperAdminPass123";
  await seedTestSuperAdmin(superAdminEmail, superAdminPassword);

  const school = await registerTestSchool(app, suffix);

  t.after(async () => {
    await deleteTestSuperAdmin(superAdminEmail);
    await cleanupTestSchool(school.schoolId, school.ownerEmail, school.schoolEmail);
    await app.close();
    await closeTestPool();
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/super-admin/auth/login",
    payload: { email: superAdminEmail, password: superAdminPassword },
  });
  assert.equal(login.statusCode, 200);
  const superAdminToken = login.json().data.token as string;

  await t.test("wrong password is rejected", async () => {
    const attempt = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/auth/login",
      payload: { email: superAdminEmail, password: "wrong" },
    });
    assert.equal(attempt.statusCode, 401);
  });

  await t.test("a tenant JWT cannot access super-admin routes", async () => {
    const attempt = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/schools",
      headers: { authorization: `Bearer ${school.token}` },
    });
    assert.equal(attempt.statusCode, 401);
  });

  await t.test("a super-admin JWT cannot satisfy tenant permission checks", async () => {
    const attempt = await app.inject({
      method: "GET",
      url: "/api/v1/students",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(attempt.statusCode, 403);
  });

  await t.test("super admin sees the school in the platform-wide list", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/schools",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(list.statusCode, 200);
    const ids = list.json().data.map((s: { id: string }) => s.id);
    assert.ok(ids.includes(school.schoolId));
  });

  await t.test("suspending a school blocks its owner from logging in, reactivating restores it", async () => {
    const suspend = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/schools/${school.schoolId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { status: "SUSPENDED", reason: "test" },
    });
    assert.equal(suspend.statusCode, 200);
    assert.equal(suspend.json().data.status, "SUSPENDED");

    const blockedLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: school.ownerEmail, password: "TestPassword123" },
    });
    assert.equal(blockedLogin.statusCode, 403);

    const reactivate = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/schools/${school.schoolId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { status: "ACTIVE" },
    });
    assert.equal(reactivate.statusCode, 200);

    const restoredLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: school.ownerEmail, password: "TestPassword123" },
    });
    assert.equal(restoredLogin.statusCode, 200);
  });

  await t.test("platform analytics and audit logs reflect the school", async () => {
    const analytics = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/analytics",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(analytics.statusCode, 200);
    assert.ok(analytics.json().data.totalSchools >= 1);

    const auditLogs = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/audit-logs?schoolId=${school.schoolId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(auditLogs.statusCode, 200);
    const actions = auditLogs.json().data.map((entry: { action: string }) => entry.action);
    assert.ok(actions.includes("school.suspended"));
    assert.ok(actions.includes("school.reactivated"));
  });
});
