import { FastifyReply, FastifyRequest } from "fastify";

import { UnauthorizedError } from "../shared/http/errors";

/**
 * Platform-level identity, structurally distinct from AuthenticatedUser
 * (middleware/auth.ts). A super admin has no schoolId/role — the `scope`
 * discriminator is what stops a tenant JWT (which never sets it) from ever
 * being accepted here, and a super-admin JWT from ever satisfying tenant
 * permission checks (which fail closed on the missing schoolId/role).
 */
export interface AuthenticatedSuperAdmin {
  superAdminId: string;
}

export interface SuperAdminJwtPayload {
  sub: string;
  scope: "super_admin";
}

export async function authenticateSuperAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<SuperAdminJwtPayload>();

    if (payload.scope !== "super_admin") {
      throw new Error("Not a super admin token.");
    }

    request.currentSuperAdmin = { superAdminId: payload.sub };
  } catch {
    throw new UnauthorizedError("A valid super admin session token is required.");
  }
}

export function getSuperAdminContext(request: FastifyRequest): AuthenticatedSuperAdmin {
  if (!request.currentSuperAdmin) {
    throw new UnauthorizedError("A valid super admin session token is required.");
  }

  return request.currentSuperAdmin;
}
