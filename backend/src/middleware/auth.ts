import { FastifyReply, FastifyRequest } from "fastify";

import { UserRole } from "../config/rbac";
import { ForbiddenError, UnauthorizedError } from "../shared/http/errors";

export interface AuthenticatedUser {
  userId: string;
  schoolId: string;
  membershipId: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface JwtAuthPayload {
  sub: string;
  schoolId: string;
  membershipId: string;
  role: UserRole;
  /** Set on tokens issued to accounts that still carry an admin-issued temporary password. */
  fpc?: boolean;
  scope?: string;
}

async function verifyTenantToken(request: FastifyRequest): Promise<JwtAuthPayload> {
  let payload: JwtAuthPayload;
  try {
    payload = await request.jwtVerify<JwtAuthPayload>();
  } catch {
    throw new UnauthorizedError("A valid session token is required.");
  }

  // Super-admin tokens are a separate identity and never valid on tenant routes.
  if (payload.scope === "super_admin") {
    throw new ForbiddenError("Platform administrator tokens cannot be used on school routes.");
  }
  if (!payload.schoolId || !payload.membershipId || !payload.role) {
    throw new UnauthorizedError("A valid session token is required.");
  }

  request.currentUser = {
    userId: payload.sub,
    schoolId: payload.schoolId,
    membershipId: payload.membershipId,
    role: payload.role,
    mustChangePassword: payload.fpc === true,
  };
  return payload;
}

/**
 * Standard tenant guard. An account that still has a temporary password can do nothing except change
 * it (see authenticateAllowPasswordChange), so a leaked temporary password grants no access to data.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const payload = await verifyTenantToken(request);
  if (payload.fpc === true) {
    throw new ForbiddenError("You must change your temporary password before continuing.");
  }
}

/** Used only by /me, logout and the forced password change itself. */
export async function authenticateAllowPasswordChange(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  await verifyTenantToken(request);
}

export function getAuthContext(request: FastifyRequest): AuthenticatedUser {
  if (!request.currentUser) {
    throw new UnauthorizedError("A valid session token is required.");
  }

  return request.currentUser;
}
