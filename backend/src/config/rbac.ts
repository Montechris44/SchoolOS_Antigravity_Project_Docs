export type UserRole = "owner" | "admin" | "bursar" | "teacher" | "parent" | "student" | "non_academic";

/** Roles that run the school day to day (Nexora's SCHOOL_ADMIN). */
export const ADMIN_ROLES: UserRole[] = ["owner", "admin"];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export type Permission =
  | "school:manage"
  | "staff:manage"
  | "students:view"
  | "students:manage"
  | "classes:view"
  | "classes:manage"
  | "attendance:mark"
  | "attendance:view_all"
  | "academics:enter_scores"
  | "academics:publish"
  | "finance:view"
  | "finance:manage"
  | "payments:record"
  | "communication:send"
  | "dashboard:view_management"
  | "intelligence:view"
  | "actions:manage"
  | "ai:query"
  | "results:review"
  | "grading:manage"
  | "timetable:manage"
  | "events:manage"
  | "leave:manage"
  | "staff_attendance:manage"
  | "assignments:manage";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "school:manage",
    "staff:manage",
    "students:view",
    "students:manage",
    "classes:view",
    "classes:manage",
    "attendance:mark",
    "attendance:view_all",
    "academics:enter_scores",
    "academics:publish",
    "finance:view",
    "finance:manage",
    "payments:record",
    "communication:send",
    "dashboard:view_management",
    "intelligence:view",
    "actions:manage",
    "ai:query",
    "results:review",
    "grading:manage",
    "timetable:manage",
    "events:manage",
    "leave:manage",
    "staff_attendance:manage",
    "assignments:manage",
  ],
  admin: [
    "staff:manage",
    "students:view",
    "students:manage",
    "classes:view",
    "classes:manage",
    "attendance:mark",
    "attendance:view_all",
    "academics:enter_scores",
    "academics:publish",
    "finance:view",
    "communication:send",
    "dashboard:view_management",
    "intelligence:view",
    "actions:manage",
    "ai:query",
    "results:review",
    "grading:manage",
    "timetable:manage",
    "events:manage",
    "leave:manage",
    "staff_attendance:manage",
    "assignments:manage",
  ],
  bursar: [
    "students:view",
    "finance:view",
    "finance:manage",
    "payments:record",
    "communication:send",
    "dashboard:view_management",
    "intelligence:view",
    "actions:manage",
    "ai:query",
  ],
  teacher: [
    "students:view",
    "classes:view",
    "attendance:mark",
    "academics:enter_scores",
    "communication:send",
    "ai:query",
    "assignments:manage",
  ],
  parent: ["students:view", "finance:view"],
  student: ["students:view"],
  non_academic: [],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
