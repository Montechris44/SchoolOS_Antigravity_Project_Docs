const test = require("node:test");
const assert = require("node:assert");

test("Student Enrollment: Enforces unique admission number within school", () => {
  const existingStudents = [
    { schoolId: "sch_1", admissionNumber: "ECA/2026/001", name: "Femi Williams" },
    { schoolId: "sch_1", admissionNumber: "ECA/2026/002", name: "Folake Williams" },
    { schoolId: "sch_2", admissionNumber: "ECA/2026/001", name: "Other Student" }, // different school allowed
  ];

  function validateNewAdmission(schoolId, admissionNumber) {
    const duplicate = existingStudents.find(
      (s) => s.schoolId === schoolId && s.admissionNumber.toUpperCase() === admissionNumber.toUpperCase()
    );
    if (duplicate) {
      throw new Error(`Admission number '${admissionNumber}' already registered in school.`);
    }
    return true;
  }

  // Attempt duplicate in same school -> should throw
  assert.throws(
    () => validateNewAdmission("sch_1", "ECA/2026/001"),
    { message: /already registered/ }
  );

  // New admission in same school -> should pass
  assert.strictEqual(validateNewAdmission("sch_1", "ECA/2026/099"), true);

  // Same admission number in another school -> should pass (multi-tenancy)
  assert.strictEqual(validateNewAdmission("sch_3", "ECA/2026/001"), true);
});

test("Class Assignment: Student must link to existing valid class", () => {
  const classes = [
    { id: "cls_jss1", name: "JSS 1 Gold", capacity: 35 },
    { id: "cls_jss2", name: "JSS 2 Silver", capacity: 35 },
  ];

  function assignStudentClass(classId) {
    const target = classes.find((c) => c.id === classId);
    if (!target) throw new Error("Invalid class assignment");
    return target.name;
  }

  assert.strictEqual(assignStudentClass("cls_jss1"), "JSS 1 Gold");
  assert.throws(() => assignStudentClass("cls_invalid"), { message: /Invalid class/ });
});
