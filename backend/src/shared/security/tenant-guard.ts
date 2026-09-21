import { Permission, UserRole, hasPermission } from "../../config/rbac";
import { AuthenticatedUser } from "../../middleware/auth";
import { ForbiddenError } from "../http/errors";

export function requirePermission(actor: AuthenticatedUser, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) {
    throw new ForbiddenError(`Role '${actor.role}' does not have required permission '${permission}'.`);
  }
}

export function requireAnyPermission(actor: AuthenticatedUser, permissions: Permission[]): void {
  if (!permissions.some((permission) => hasPermission(actor.role, permission))) {
    throw new ForbiddenError(
      `Role '${actor.role}' does not have any of the required permissions: ${permissions.join(", ")}.`
    );
  }
}

export function requireSameSchool(actor: AuthenticatedUser, schoolId: string): void {
  if (actor.schoolId !== schoolId) {
    throw new ForbiddenError("Cross-school access is not allowed.");
  }
}

export function requireSchoolPermission(actor: AuthenticatedUser, schoolId: string, permission: Permission): void {
  requireSameSchool(actor, schoolId);
  requirePermission(actor, permission);
}

export function requireRole(actor: AuthenticatedUser, roles: UserRole[]): void {
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError(`Role '${actor.role}' is not allowed to perform this action.`);
  }
}
