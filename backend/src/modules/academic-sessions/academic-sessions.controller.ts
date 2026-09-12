import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { createAcademicSession, listAcademicSessions } from "./academic-sessions.service";
import { createAcademicSessionSchema } from "./academic-sessions.schemas";

export async function listAcademicSessionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const sessions = await listAcademicSessions(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(sessions)));
}

export async function createAcademicSessionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "school:manage");

  const input = validateBody(request, createAcademicSessionSchema);
  const session = await createAcademicSession(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(session)));
}
