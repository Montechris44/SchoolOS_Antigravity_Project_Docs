import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { query } from "../../db/pool";
import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { NotFoundError } from "../../shared/http/errors";
import { ok } from "../../shared/http/reply";
import { requireAnyPermission, requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { getStudentById } from "../students/students.service";
import {
  assertCanTakeAttendance,
  getOverview,
  getRoster,
  getStudentHistory,
  getStudentRates,
  listAttendance,
  markAttendance,
} from "./attendance.service";
import { historyQuerySchema, listAttendanceQuerySchema, markAttendanceSchema, overviewQuerySchema } from "./attendance.schemas";

export async function listAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requireAnyPermission(actor, ["attendance:mark", "attendance:view_all"]);

  const { classId, armId, date } = validateQuery(request, listAttendanceQuerySchema);
  await assertCanTakeAttendance(actor, classId, armId);
  const records = await listAttendance(actor.schoolId, classId, date, armId);
  reply.status(200).send(ok(toCamelCase(records)));
}

export async function rosterHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "attendance:mark");

  const { classId, armId, date } = validateQuery(request, listAttendanceQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getRoster(actor, classId, date, armId))));
}

export async function markAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "attendance:mark");

  const input = validateBody(request, markAttendanceSchema);
  const records = await markAttendance(actor, input);
  reply.status(200).send(ok(toCamelCase(records)));
}

export async function overviewHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "attendance:view_all");

  const filters = validateQuery(request, overviewQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getOverview(actor.schoolId, filters))));
}

export async function ratesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "attendance:view_all");

  const filters = validateQuery(request, overviewQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getStudentRates(actor.schoolId, filters))));
}

export async function myAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requireRole(actor, ["student"]);

  const range = validateQuery(request, historyQuerySchema);
  const student = await query<{ id: string }>("SELECT id FROM students WHERE user_id = $1 AND school_id = $2", [
    actor.userId,
    actor.schoolId,
  ]);
  if (student.rowCount === 0) throw new NotFoundError("No student record is linked to this account.");
  reply.status(200).send(ok(toCamelCase(await getStudentHistory(actor.schoolId, student.rows[0].id, range))));
}

/** A student's history for a parent (their own child), a teacher (their class) or an administrator. */
export async function studentAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { studentId } = validateParams(request, z.object({ studentId: z.string().uuid() }));
  await getStudentById(actor, studentId);

  const range = validateQuery(request, historyQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getStudentHistory(actor.schoolId, studentId, range))));
}
