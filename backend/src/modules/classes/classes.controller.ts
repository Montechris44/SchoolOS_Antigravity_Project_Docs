import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams } from "../../shared/validation/validate";
import {
  assignArmClassTeacher,
  assignClassLevelTeacher,
  clearArmClassTeacher,
  clearClassLevelTeacher,
  createArm,
  createClass,
  deleteArm,
  deleteClass,
  listClasses,
  updateArm,
} from "./classes.service";
import {
  armIdParamsSchema,
  assignClassTeacherSchema,
  classIdParamsSchema,
  createArmSchema,
  createClassSchema,
  updateArmSchema,
} from "./classes.schemas";

export async function listClassesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const classes = await listClasses(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(classes)));
}

export async function createClassHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createClassSchema);
  const schoolClass = await createClass(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(schoolClass)));
}

export async function deleteClassHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { classId } = validateParams(request, classIdParamsSchema);
  await deleteClass(actor.schoolId, actor.userId, classId);
  reply.status(200).send(ok({ deleted: true }));
}

export async function createArmHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createArmSchema);
  const schoolClass = await createArm(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(schoolClass)));
}

export async function updateArmHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { armId } = validateParams(request, armIdParamsSchema);
  const input = validateBody(request, updateArmSchema);
  const schoolClass = await updateArm(actor.schoolId, armId, input);
  reply.status(200).send(ok(toCamelCase(schoolClass)));
}

export async function deleteArmHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { armId } = validateParams(request, armIdParamsSchema);
  await deleteArm(actor.schoolId, actor.userId, armId);
  reply.status(200).send(ok({ deleted: true }));
}

export async function assignArmTeacherHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { armId } = validateParams(request, armIdParamsSchema);
  const { teacherId } = validateBody(request, assignClassTeacherSchema);
  await assignArmClassTeacher(actor.schoolId, actor.userId, armId, teacherId);
  reply.status(200).send(ok({ assigned: true }));
}

export async function clearArmTeacherHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { armId } = validateParams(request, armIdParamsSchema);
  await clearArmClassTeacher(actor.schoolId, actor.userId, armId);
  reply.status(200).send(ok({ cleared: true }));
}

export async function assignClassTeacherHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { classId } = validateParams(request, classIdParamsSchema);
  const { teacherId } = validateBody(request, assignClassTeacherSchema);
  await assignClassLevelTeacher(actor.schoolId, actor.userId, classId, teacherId);
  reply.status(200).send(ok({ assigned: true }));
}

export async function clearClassTeacherHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const { classId } = validateParams(request, classIdParamsSchema);
  await clearClassLevelTeacher(actor.schoolId, actor.userId, classId);
  reply.status(200).send(ok({ cleared: true }));
}
