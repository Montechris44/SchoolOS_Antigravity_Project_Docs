import { User, UserRole, School } from "@/types";

export interface AuthSession {
  user: User;
  school: School;
  role: UserRole;
  token: string;
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
  | "ai:query";

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
  ],
  parent: [
    "students:view",
    "finance:view",
  ],
  student: [
    "students:view",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
