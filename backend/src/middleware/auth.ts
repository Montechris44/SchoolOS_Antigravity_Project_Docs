import { FastifyReply, FastifyRequest } from "fastify";

import { UserRole } from "../config/rbac";
import { UnauthorizedError } from "../shared/http/errors";

export interface AuthenticatedUser {
  userId: string;
  schoolId: string;
  membershipId: string;
  role: UserRole;
}

export interface JwtAuthPayload {
  sub: string;
  schoolId: string;
  membershipId: string;
  role: UserRole;
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtAuthPayload>();

    request.currentUser = {
      userId: payload.sub,
      schoolId: payload.schoolId,
      membershipId: payload.membershipId,
      role: payload.role,
    };
  } catch {
    throw new UnauthorizedError("A valid session token is required.");
  }
}

export function getAuthContext(request: FastifyRequest): AuthenticatedUser {
  if (!request.currentUser) {
    throw new UnauthorizedError("A valid session token is required.");
  }

  return request.currentUser;
}
