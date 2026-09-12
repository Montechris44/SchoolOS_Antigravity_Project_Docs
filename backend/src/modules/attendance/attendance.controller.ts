import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requireAnyPermission, requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { listAttendance, markAttendance } from "./attendance.service";
import { listAttendanceQuerySchema, markAttendanceSchema } from "./attendance.schemas";

export async function listAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requireAnyPermission(actor, ["attendance:mark", "attendance:view_all"]);

  const { classId, date } = validateQuery(request, listAttendanceQuerySchema);
  const records = await listAttendance(actor.schoolId, classId, date);
  reply.status(200).send(ok(toCamelCase(records)));
}

export async function markAttendanceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "attendance:mark");

  const input = validateBody(request, markAttendanceSchema);
  const records = await markAttendance(actor.schoolId, actor.userId, input);
  reply.status(200).send(ok(toCamelCase(records)));
}
