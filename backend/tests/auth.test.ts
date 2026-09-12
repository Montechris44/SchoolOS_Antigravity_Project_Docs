import assert from "node:assert/strict";
import test from "node:test";

import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

test("auth: register, login, /me, and rejection paths", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const { response, body, token, schoolId, ownerEmail, schoolEmail } = await registerTestSchool(app, suffix);

  t.after(async () => {
    await cleanupTestSchool(schoolId, ownerEmail, schoolEmail);
    await app.close();
    await closeTestPool();
  });

  await t.test("register-school returns a session", () => {
    assert.equal(response.statusCode, 201);
    assert.equal(body.data.role, "owner");
    assert.ok(body.data.token);
    assert.equal(body.data.school.name, `Test School ${suffix}`);
  });

  await t.test("duplicate registration email is rejected", async () => {
    const dupe = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register-school",
      payload: {
        school: {
          name: "Another School",
          address: "2 Test Street",
          city: "Lagos",
          state: "Lagos",
          phone: "+2348000000001",
          email: `other+${suffix}@backend-tests.local`,
        },
        owner: { fullName: "Someone Else", email: ownerEmail, password: "TestPassword123" },
      },
    });
    assert.equal(dupe.statusCode, 409);
  });

  await t.test("login succeeds with correct credentials", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ownerEmail, password: "TestPassword123" },
    });
    assert.equal(login.statusCode, 200);
    assert.ok(login.json().data.token);
  });

  await t.test("login fails with wrong password", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ownerEmail, password: "WrongPassword" },
    });
    assert.equal(login.statusCode, 401);
  });

  await t.test("/me requires a valid token", async () => {
    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/me" });
    assert.equal(unauthenticated.statusCode, 401);

    const authenticated = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(authenticated.statusCode, 200);
    assert.equal(authenticated.json().data.user.email, ownerEmail);
  });
});
