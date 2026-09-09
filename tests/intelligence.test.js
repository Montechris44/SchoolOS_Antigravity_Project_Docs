const test = require("node:test");
const assert = require("node:assert");

function evaluateAttendanceSignal(student, attendanceRate, threshold = 75) {
  if (attendanceRate < threshold) {
    return {
      type: "LOW_ATTENDANCE",
      studentId: student.id,
      severity: "high",
      metricValue: `${attendanceRate}% Attendance`,
    };
  }
  return null;
}

function evaluateOverdueFeeSignal(invoice, daysOverdue, thresholdDays = 7) {
  if (invoice.balanceDue > 0 && daysOverdue > thresholdDays) {
    return {
      type: "OVERDUE_FEES",
      invoiceId: invoice.id,
      severity: "critical",
      metricValue: `₦${invoice.balanceDue.toLocaleString()} Overdue`,
    };
  }
  return null;
}

function createActionFromSignal(signal, assignedTo) {
  return {
    id: `act_${Date.now()}`,
    signalId: signal.type,
    priority: signal.severity === "critical" ? "P0" : "P1",
    assignedTo,
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };
}

function resolveAction(action, outcome) {
  return {
    ...action,
    status: "RESOLVED",
    outcome,
    resolvedAt: new Date().toISOString(),
  };
}

test("Intelligence: Accurately raises deterministic signals from real metrics", () => {
  const student = { id: "std_01", name: "Chioma Eze" };
  const signal = evaluateAttendanceSignal(student, 50, 75);

  assert.notStrictEqual(signal, null);
  assert.strictEqual(signal.type, "LOW_ATTENDANCE");
  assert.strictEqual(signal.severity, "high");

  const invoice = { id: "inv_01", balanceDue: 185000 };
  const feeSignal = evaluateOverdueFeeSignal(invoice, 8, 7);
  assert.notStrictEqual(feeSignal, null);
  assert.strictEqual(feeSignal.type, "OVERDUE_FEES");
  assert.strictEqual(feeSignal.severity, "critical");
});

test("Action Center: Converts signal to actionable task and tracks resolution", () => {
  const signal = { type: "LOW_ATTENDANCE", severity: "high" };
  const action = createActionFromSignal(signal, "Mr. Musa");

  assert.strictEqual(action.status, "OPEN");
  assert.strictEqual(action.priority, "P1");
  assert.strictEqual(action.assignedTo, "Mr. Musa");

  const resolved = resolveAction(action, "Parent contacted; medical excuse received");
  assert.strictEqual(resolved.status, "RESOLVED");
  assert.strictEqual(resolved.outcome, "Parent contacted; medical excuse received");
  assert.notStrictEqual(resolved.resolvedAt, undefined);
});
