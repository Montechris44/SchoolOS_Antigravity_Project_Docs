const test = require("node:test");
const assert = require("node:assert");

function calculateAttendanceRate(records, totalExpectedDays) {
  if (totalExpectedDays === 0) return 100;
  const presentCount = records.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;
  return Math.round((presentCount / totalExpectedDays) * 100);
}

function shouldTriggerLowAttendanceSignal(rate, threshold = 75) {
  return rate < threshold;
}

test("Attendance: Calculates accurate attendance percentage", () => {
  const records = [
    { status: "PRESENT" },
    { status: "PRESENT" },
    { status: "ABSENT" },
    { status: "LATE" },
  ];
  // 3 present/late out of 4 days = 75%
  assert.strictEqual(calculateAttendanceRate(records, 4), 75);
});

test("Attendance Signal: Triggers low-attendance signal when rate drops below 75%", () => {
  assert.strictEqual(shouldTriggerLowAttendanceSignal(62), true);
  assert.strictEqual(shouldTriggerLowAttendanceSignal(74), true);
  assert.strictEqual(shouldTriggerLowAttendanceSignal(75), false);
  assert.strictEqual(shouldTriggerLowAttendanceSignal(90), false);
});
