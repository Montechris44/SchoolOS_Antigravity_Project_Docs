import crypto from "crypto";

import { buildApp } from "../src/app";
import { pool } from "../src/db/pool";

export function buildTestApp() {
  return buildApp();
}

export function uniqueSuffix(): string {
  return crypto.randomBytes(4).toString("hex");
}

export async function registerTestSchool(app: ReturnType<typeof buildApp>, suffix: string) {
  const ownerEmail = `owner+${suffix}@backend-tests.local`;
  const schoolEmail = `info+${suffix}@backend-tests.local`;

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register-school",
    payload: {
      school: {
        name: `Test School ${suffix}`,
        address: "1 Test Street",
        city: "Lagos",
        state: "Lagos",
        phone: "+2348000000000",
        email: schoolEmail,
      },
      owner: {
        fullName: `Owner ${suffix}`,
        email: ownerEmail,
        password: "TestPassword123",
      },
    },
  });

  const body = response.json();
  return {
    response,
    body,
    token: body.data?.token as string,
    schoolId: body.data?.school?.id as string,
    ownerEmail,
    schoolEmail,
  };
}

export async function cleanupTestSchool(schoolId: string, ownerEmail: string, schoolEmail?: string): Promise<void> {
  await pool.query("DELETE FROM schools WHERE id = $1", [schoolId]);
  await pool.query("DELETE FROM profiles WHERE email = $1", [ownerEmail]);
  if (schoolEmail) {
    await pool.query("DELETE FROM profiles WHERE email = $1", [schoolEmail]);
  }
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}
