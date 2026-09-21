import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { BadRequestError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { schoolFolder, uploadToStorage } from "../../shared/storage/cloudinary";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import {
  bulkImportStudents,
  createPortalAccount,
  createStudent,
  getStudentAcademicSummary,
  getStudentById,
  listStudents,
  resetStudentPassword,
  setStudentPhoto,
  updateStudent,
} from "./students.service";
import {
  bulkImportSchema,
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdParamsSchema,
  updateStudentSchema,
} from "./students.schemas";

export async function listStudentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const filters = validateQuery(request, listStudentsQuerySchema);
  const students = await listStudents(actor, filters);
  reply.status(200).send(ok(toCamelCase(students)));
}

export async function getStudentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  const student = await getStudentById(actor, studentId);
  reply.status(200).send(ok(toCamelCase(student)));
}

export async function createStudentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const input = validateBody(request, createStudentSchema);
  const { student, credentials } = await createStudent(actor.schoolId, actor.userId, input);

  // The student record stays at the top level (existing clients read it as a Student); the one-time
  // sign-in credentials ride along for the administrator to hand over.
  reply.status(201).send(created({ ...toCamelCase<Record<string, unknown>>(student), credentials }));
}

export async function bulkImportHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const { students } = validateBody(request, bulkImportSchema);
  const result = await bulkImportStudents(actor.schoolId, actor.userId, students);
  reply.status(201).send(created(toCamelCase({ success: result.success, failed: result.failed })));
}

export async function updateStudentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  const input = validateBody(request, updateStudentSchema);
  reply.status(200).send(ok(toCamelCase(await updateStudent(actor.schoolId, actor.userId, studentId, input))));
}

export async function resetStudentPasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  const temporaryPassword = await resetStudentPassword(actor.schoolId, actor.userId, studentId);
  reply.status(200).send(ok({ temporaryPassword }));
}

export async function createPortalAccountHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  reply.status(201).send(created(await createPortalAccount(actor.schoolId, actor.userId, studentId)));
}

export async function uploadStudentPhotoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  const file = await request.file();
  if (!file) throw new BadRequestError("Attach an image in the 'file' field.");

  const uploaded = await uploadToStorage(await file.toBuffer(), schoolFolder(actor.schoolId, "students"), "image");
  await setStudentPhoto(actor.schoolId, actor.userId, studentId, uploaded.url);
  reply.status(200).send(ok({ photoUrl: uploaded.url }));
}

export async function studentSummaryHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const { studentId } = validateParams(request, studentIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await getStudentAcademicSummary(actor, studentId))));
}
