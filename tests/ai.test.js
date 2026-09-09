const test = require("node:test");
const assert = require("node:assert");

const ROLE_PERMISSIONS = {
  owner: ["dashboard:view_management", "attendance:mark", "finance:view", "communication:send"],
  admin: ["dashboard:view_management", "attendance:mark", "finance:view", "communication:send"],
  teacher: ["attendance:mark", "communication:send"],
  parent: ["students:view"],
  student: ["students:view"],
};

function hasPermission(role, perm) {
  return (ROLE_PERMISSIONS[role] || []).includes(perm);
}

function executeAITool(ctx, toolName) {
  if (toolName === "get_school_overview" || toolName === "get_outstanding_balances") {
    if (!hasPermission(ctx.role, "dashboard:view_management") && !hasPermission(ctx.role, "finance:view")) {
      return { success: false, error: "Access denied: insufficient role permissions" };
    }
    return {
      success: true,
      data: {
        totalBilled: 335000,
        totalCollected: 150000,
        outstandingDue: 185000,
      },
    };
  }

  if (toolName === "get_attendance_risks") {
    if (!hasPermission(ctx.role, "attendance:mark")) {
      return { success: false, error: "Access denied: insufficient role permissions" };
    }
    return {
      success: true,
      data: [{ studentName: "Chioma Eze", attendanceRate: "50%" }],
    };
  }

  return { success: false, error: "Unknown tool" };
}

test("AI Gateway: Owner successfully accesses school overview and fee balances", () => {
  const ownerCtx = { role: "owner", userSchoolId: "sch_1" };
  const res = executeAITool(ownerCtx, "get_school_overview");

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.totalBilled, 335000);
  assert.strictEqual(res.data.outstandingDue, 185000);
});

test("AI Gateway: Student role is strictly blocked from querying financial balances", () => {
  const studentCtx = { role: "student", userSchoolId: "sch_1" };
  const res = executeAITool(studentCtx, "get_outstanding_balances");

  assert.strictEqual(res.success, false);
  assert.match(res.error, /insufficient role permissions/);
});

test("AI Gateway: Teacher can query attendance risks but cannot access school overview", () => {
  const teacherCtx = { role: "teacher", userSchoolId: "sch_1" };
  const attRes = executeAITool(teacherCtx, "get_attendance_risks");
  assert.strictEqual(attRes.success, true);
  assert.strictEqual(attRes.data[0].studentName, "Chioma Eze");

  const finRes = executeAITool(teacherCtx, "get_school_overview");
  assert.strictEqual(finRes.success, false);
});
