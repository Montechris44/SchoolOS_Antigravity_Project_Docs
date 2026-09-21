import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import {
  createStaff,
  deleteStaff,
  getStaff,
  getStaffSchedule,
  listStaff,
  resetStaffPassword,
  toggleStaff,
  updateStaff,
} from "./staff.service";
import { createStaffSchema, staffIdParamsSchema, updateStaffSchema } from "./staff.schemas";

const listQuerySchema = z.object({
  role: z.enum(["admin", "bursar", "teacher", "non_academic"]).optional(),
  search: z.string().max(100).optional(),
});

export async function listStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const filters = validateQuery(request, listQuerySchema);
  const staff = await listStaff(actor.schoolId, filters);
  reply.status(200).send(ok(toCamelCase(staff)));
}

export async function getStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await getStaff(actor.schoolId, userId))));
}

export async function createStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const input = validateBody(request, createStaffSchema);
  const staff = await createStaff(actor.schoolId, actor.userId, input);
  reply.status(201).send(created(toCamelCase(staff)));
}

export async function updateStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  const input = validateBody(request, updateStaffSchema);
  reply.status(200).send(ok(toCamelCase(await updateStaff(actor.schoolId, actor.userId, userId, input))));
}

export async function toggleStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await toggleStaff(actor.schoolId, actor.userId, userId))));
}

export async function deleteStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  await deleteStaff(actor.schoolId, actor.userId, userId);
  reply.status(200).send(ok({ deleted: true }));
}

export async function resetStaffPasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  const temporaryPassword = await resetStaffPassword(actor.schoolId, actor.userId, userId);
  reply.status(200).send(ok({ temporaryPassword }));
}

export async function staffScheduleHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const { userId } = validateParams(request, staffIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await getStaffSchedule(actor.schoolId, userId))));
}
