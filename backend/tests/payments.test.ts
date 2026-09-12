import assert from "node:assert/strict";
import test from "node:test";

import { buildTestApp, cleanupTestSchool, closeTestPool, registerTestSchool, uniqueSuffix } from "./helpers";

test("payments: webhook idempotency protects against double-crediting", async (t) => {
  const app = buildTestApp();
  const suffix = uniqueSuffix();
  const { token, schoolId, ownerEmail, schoolEmail } = await registerTestSchool(app, suffix);

  t.after(async () => {
    await cleanupTestSchool(schoolId, ownerEmail, schoolEmail);
    await app.close();
    await closeTestPool();
  });

  const classResult = await app.inject({
    method: "POST",
    url: "/api/v1/classes",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Payments Class", gradeLevel: "JSS 1", capacity: 30 },
  });
  const classId = classResult.json().data.id;

  const studentResult = await app.inject({
    method: "POST",
    url: "/api/v1/students",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      admissionNumber: "PAY/001",
      firstName: "Pay",
      lastName: "Test",
      gender: "female",
      dateOfBirth: "2013-01-01",
      classId,
    },
  });
  const studentId = studentResult.json().data.id;

  const invoiceResult = await app.inject({
    method: "POST",
    url: "/api/v1/invoices",
    headers: { authorization: `Bearer ${token}` },
    payload: { studentId, description: "Term fees", amount: 100000, dueDate: "2026-12-31" },
  });
  const invoiceId = invoiceResult.json().data.id;

  const webhookPayload = {
    event: "charge.success",
    data: {
      reference: `pstk_ref_${suffix}`,
      amount: 10000000,
      customer: { email: "parent@example.com" },
      metadata: { schoolId, invoiceId, studentId, payerName: "Parent Test" },
    },
  };

  const first = await app.inject({ method: "POST", url: "/api/v1/payments/webhook", payload: webhookPayload });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().isDuplicate, false);

  const second = await app.inject({ method: "POST", url: "/api/v1/payments/webhook", payload: webhookPayload });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().isDuplicate, true);

  const invoiceAfter = await app.inject({
    method: "GET",
    url: "/api/v1/invoices",
    headers: { authorization: `Bearer ${token}` },
  });
  const invoice = invoiceAfter.json().data.find((i: { id: string }) => i.id === invoiceId);

  assert.equal(invoice.amountPaid, 100000, "amount paid must reflect exactly one credit, not two");
  assert.equal(invoice.status, "PAID");

  const payments = await app.inject({
    method: "GET",
    url: "/api/v1/payments",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(payments.json().data.length, 1, "duplicate webhook must not create a second payment row");
});
