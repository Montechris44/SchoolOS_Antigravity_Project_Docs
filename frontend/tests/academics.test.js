const test = require("node:test");
const assert = require("node:assert");

const STANDARD_WAEC_SCALE = [
  { grade: "A", minScore: 75, maxScore: 100, remark: "Distinction" },
  { grade: "B", minScore: 65, maxScore: 74, remark: "Very Good" },
  { grade: "C", minScore: 50, maxScore: 64, remark: "Credit" },
  { grade: "D", minScore: 40, maxScore: 49, remark: "Pass" },
  { grade: "F", minScore: 0, maxScore: 39, remark: "Fail" },
];

function getGradeForScore(score) {
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  for (const b of STANDARD_WAEC_SCALE) {
    if (bounded >= b.minScore && bounded <= b.maxScore) {
      return b.grade;
    }
  }
  return "F";
}

function calculateReportCardAverage(subjectTotals) {
  if (subjectTotals.length === 0) return 0;
  const sum = subjectTotals.reduce((a, b) => a + b, 0);
  return Number((sum / subjectTotals.length).toFixed(1));
}

test("Grading Engine: Maps percentage scores accurately to WAEC grade scale", () => {
  assert.strictEqual(getGradeForScore(88), "A");
  assert.strictEqual(getGradeForScore(75), "A");
  assert.strictEqual(getGradeForScore(74), "B");
  assert.strictEqual(getGradeForScore(65), "B");
  assert.strictEqual(getGradeForScore(64), "C");
  assert.strictEqual(getGradeForScore(50), "C");
  assert.strictEqual(getGradeForScore(49), "D");
  assert.strictEqual(getGradeForScore(40), "D");
  assert.strictEqual(getGradeForScore(39), "F");
  assert.strictEqual(getGradeForScore(0), "F");
});

test("Grading Engine: Computes student overall terminal average", () => {
  const scores = [85, 78, 92, 65, 70]; // sum = 390, len = 5, avg = 78.0
  assert.strictEqual(calculateReportCardAverage(scores), 78.0);
});
