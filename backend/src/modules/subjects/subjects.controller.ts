import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams } from "../../shared/validation/validate";
import { addFromCatalog, createSubject, listCatalog, listSubjects, toggleSubject, updateSubject } from "./subjects.service";
import { createSubjectSchema, fromCatalogSchema, subjectIdParamsSchema, updateSubjectSchema } from "./subjects.schemas";

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

export async function updateSubjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { subjectId } = validateParams(request, subjectIdParamsSchema);
  const input = validateBody(request, updateSubjectSchema);
  reply.status(200).send(ok(toCamelCase(await updateSubject(actor.schoolId, subjectId, input))));
}

export async function toggleSubjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { subjectId } = validateParams(request, subjectIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await toggleSubject(actor.schoolId, subjectId))));
}

export async function listCatalogHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  reply.status(200).send(ok(toCamelCase(await listCatalog(actor.schoolId))));
}

export async function addFromCatalogHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { globalSubjectIds } = validateBody(request, fromCatalogSchema);
  reply.status(201).send(created(toCamelCase(await addFromCatalog(actor.schoolId, globalSubjectIds))));
}
