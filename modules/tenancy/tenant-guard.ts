/**
 * SchoolOS Tenancy & RBAC Guard
 * Prevents cross-tenant leaks and validates role permissions on every transaction.
 */

import { UserRole } from "@/types";
import { Permission, hasPermission } from "@/lib/auth/types";

export class TenantSecurityError extends Error {
  constructor(message: string = "Access denied: cross-tenant operation detected.") {
    super(message);
    this.name = "TenantSecurityError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = "Access denied: insufficient role permissions.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface SecurityContext {
  userId: string;
  userSchoolId: string;
  role: UserRole;
}

/**
 * Enforces that the actor's authorized school matches the target entity's school.
 * Throws TenantSecurityError if tenant mismatch occurs.
 */
export function assertTenantAccess(context: SecurityContext, targetSchoolId: string): void {
  if (!targetSchoolId || context.userSchoolId !== targetSchoolId) {
    throw new TenantSecurityError(
      `Tenant breach detected! User school '${context.userSchoolId}' cannot access resource in school '${targetSchoolId}'`
    );
  }
}

/**
 * Enforces role permissions.
 * Throws AuthorizationError if actor lacks permission.
 */
export function assertPermission(context: SecurityContext, permission: Permission): void {
  if (!hasPermission(context.role, permission)) {
    throw new AuthorizationError(
      `Role '${context.role}' does not have required permission '${permission}'`
    );
  }
}
