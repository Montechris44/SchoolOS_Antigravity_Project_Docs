import { FastifyReply, FastifyRequest } from "fastify";

import { JwtAuthPayload, getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { validateBody } from "../../shared/validation/validate";
import { loginSchema, registerSchoolSchema } from "./auth.schemas";
import { AuthResult, getCurrentUser, login, registerSchool } from "./auth.service";

function buildSessionPayload(result: AuthResult, token: string) {
  return {
    user: { ...toCamelCase<Record<string, unknown>>(result.user), role: result.role },
    school: toCamelCase(result.school),
    role: result.role,
    token,
  };
}

export async function registerSchoolHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = validateBody(request, registerSchoolSchema);
  const result = await registerSchool(input);

  const token = await reply.jwtSign({
    sub: result.user.id,
    schoolId: result.school.id,
    membershipId: result.membershipId,
    role: result.role,
  } satisfies JwtAuthPayload);

  reply.status(201).send(ok(buildSessionPayload(result, token)));
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = validateBody(request, loginSchema);
  const result = await login(input);

  const token = await reply.jwtSign({
    sub: result.user.id,
    schoolId: result.school.id,
    membershipId: result.membershipId,
    role: result.role,
  } satisfies JwtAuthPayload);

  reply.status(200).send(ok(buildSessionPayload(result, token)));
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const result = await getCurrentUser(actor.userId, actor.schoolId, actor.membershipId);

  reply.status(200).send(
    ok({
      user: { ...toCamelCase<Record<string, unknown>>(result.user), role: result.role },
      school: toCamelCase(result.school),
      role: result.role,
    })
  );
}
