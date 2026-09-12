import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { createSubject, listSubjects } from "./subjects.service";
import { createSubjectSchema } from "./subjects.schemas";

export async function listSubjectsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const subjects = await listSubjects(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(subjects)));
}

export async function createSubjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createSubjectSchema);
  const subject = await createSubject(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(subject)));
}
