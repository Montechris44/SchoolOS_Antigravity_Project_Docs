import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams } from "../../shared/validation/validate";
import {
  createAcademicSession,
  getAcademicStatus,
  listAcademicSessions,
  setCurrentSession,
  setCurrentTerm,
  setTermActive,
} from "./academic-sessions.service";
import { createAcademicSessionSchema, sessionIdParamsSchema, termIdParamsSchema } from "./academic-sessions.schemas";

export async function listAcademicSessionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const sessions = await listAcademicSessions(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(sessions)));
}

export async function createAcademicSessionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createAcademicSessionSchema);
  const session = await createAcademicSession(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(session)));
}

/** Any signed-in member can read the calendar: it is the default filter on results, timetable and fees screens. */
export async function academicStatusHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const status = await getAcademicStatus(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(status)));
}

export async function setCurrentSessionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { sessionId } = validateParams(request, sessionIdParamsSchema);
  const session = await setCurrentSession(actor.schoolId, actor.userId, sessionId);
  reply.status(200).send(ok(toCamelCase(session)));
}

export async function setCurrentTermHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { termId } = validateParams(request, termIdParamsSchema);
  const term = await setCurrentTerm(actor.schoolId, actor.userId, termId);
  reply.status(200).send(ok(toCamelCase(term)));
}

export async function deactivateTermHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { termId } = validateParams(request, termIdParamsSchema);
  const term = await setTermActive(actor.schoolId, actor.userId, termId, false);
  reply.status(200).send(ok(toCamelCase(term)));
}

export async function reactivateTermHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { termId } = validateParams(request, termIdParamsSchema);
  const term = await setTermActive(actor.schoolId, actor.userId, termId, true);
  reply.status(200).send(ok(toCamelCase(term)));
}
