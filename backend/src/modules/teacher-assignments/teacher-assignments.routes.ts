import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { isAdminRole } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { ForbiddenError } from "../../shared/http/errors";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { createAssignment, deleteAssignment, listAssignments } from "./teacher-assignments.service";

const uuid = z.string().uuid();
const createSchema = z.object({
  teacherId: uuid,
  classId: uuid,
  armId: uuid.nullish(),
  subjectId: uuid,
  termId: uuid.nullish(),
  sessionId: uuid.nullish(),
});
const listSchema = z.object({ teacherId: uuid.optional(), classId: uuid.optional() });
const idSchema = z.object({ assignmentId: uuid });

async function listHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const filters = validateQuery(request, listSchema);

  // Teachers may only read their own assignments; managers may read anyone's.
  if (!isAdminRole(actor.role)) {
    if (actor.role !== "teacher") throw new ForbiddenError();
    filters.teacherId = actor.userId;
  }
  reply.status(200).send(ok(toCamelCase(await listAssignments(actor.schoolId, filters))));
}

async function createHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createSchema);
  reply.status(201).send(created(toCamelCase(await createAssignment(actor.schoolId, actor.userId, input))));
}

async function deleteHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { assignmentId } = validateParams(request, idSchema);
  await deleteAssignment(actor.schoolId, actor.userId, assignmentId);
  reply.status(200).send(ok({ deleted: true }));
}

export async function teacherAssignmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher-assignments", { preHandler: authenticate }, listHandler);
  app.post("/teacher-assignments", { preHandler: authenticate }, createHandler);
  app.delete("/teacher-assignments/:assignmentId", { preHandler: authenticate }, deleteHandler);
}
