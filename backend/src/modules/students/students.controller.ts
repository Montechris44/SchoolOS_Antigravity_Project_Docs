import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { createStudent, getStudentById, listStudents } from "./students.service";
import { createStudentSchema, listStudentsQuerySchema, studentIdParamsSchema } from "./students.schemas";

export async function listStudentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const { classId } = validateQuery(request, listStudentsQuerySchema);
  const students = await listStudents(actor.schoolId, classId);
  reply.status(200).send(ok(toCamelCase(students)));
}

export async function getStudentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  const student = await getStudentById(actor.schoolId, studentId);
  reply.status(200).send(ok(toCamelCase(student)));
}

export async function createStudentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const input = validateBody(request, createStudentSchema);
  const student = await createStudent(actor.schoolId, input);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "student.enrolled",
    resourceType: "student",
    resourceId: student.id,
  });

  reply.status(201).send(created(toCamelCase(student)));
}
