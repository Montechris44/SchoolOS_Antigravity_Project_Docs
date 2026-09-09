/**
 * Automated Tenant Isolation & RBAC Test Suite
 * Verifies that two schools cannot access each other's data and unauthorized roles are blocked.
 */

const test = require("node:test");
const assert = require("node:assert");

// Test Security Guards
function assertTenantAccess(context, targetSchoolId) {
  if (!targetSchoolId || context.userSchoolId !== targetSchoolId) {
    throw new Error(
      `Tenant breach detected! User school '${context.userSchoolId}' cannot access resource in school '${targetSchoolId}'`
    );
  }
}

const ROLE_PERMISSIONS = {
  owner: ["school:manage", "finance:manage", "students:manage", "attendance:mark"],
  teacher: ["students:view", "attendance:mark", "academics:enter_scores"],
  parent: ["students:view", "finance:view"],
  student: ["students:view"],
};

function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

test("Tenant Isolation: School A cannot access School B student records", () => {
  const schoolAContext = {
    userId: "usr_owner_01",
    userSchoolId: "sch_emerald_crest_001",
    role: "owner",
  };

  const schoolBStudent = {
    id: "std_gf_kemi_05",
    schoolId: "sch_gracefield_002",
    name: "Kemi Ade",
  };

  assert.throws(
    () => {
      assertTenantAccess(schoolAContext, schoolBStudent.schoolId);
    },
    {
      name: "Error",
      message: /Tenant breach detected/,
    },
    "Cross-tenant access must throw a Tenant Breach error"
  );
});

test("Tenant Isolation: School B cannot access School A invoices", () => {
  const schoolBContext = {
    userId: "usr_gf_admin",
    userSchoolId: "sch_gracefield_002",
    role: "admin",
  };

  const schoolAInvoice = {
    id: "inv_2026_001",
    schoolId: "sch_emerald_crest_001",
    invoiceNumber: "INV-2026-001",
  };

  assert.throws(
    () => {
      assertTenantAccess(schoolBContext, schoolAInvoice.schoolId);
    },
    {
      name: "Error",
      message: /Tenant breach detected/,
    },
    "School B querying School A invoice must be strictly blocked"
  );
});

test("Tenant Isolation: Legitimate same-tenant query succeeds", () => {
  const schoolAContext = {
    userId: "usr_owner_01",
    userSchoolId: "sch_emerald_crest_001",
    role: "owner",
  };

  const schoolAStudent = {
    id: "std_femi_01",
    schoolId: "sch_emerald_crest_001",
    name: "Femi Williams",
  };

  assert.doesNotThrow(() => {
    assertTenantAccess(schoolAContext, schoolAStudent.schoolId);
  }, "Same-tenant access must be permitted");
});

test("RBAC Security: Parent role cannot manage finance or modify school settings", () => {
  assert.strictEqual(hasPermission("parent", "finance:manage"), false);
  assert.strictEqual(hasPermission("parent", "school:manage"), false);
  assert.strictEqual(hasPermission("parent", "finance:view"), true);
});

test("RBAC Security: Teacher role cannot alter fee structures", () => {
  assert.strictEqual(hasPermission("teacher", "finance:manage"), false);
  assert.strictEqual(hasPermission("teacher", "attendance:mark"), true);
});
