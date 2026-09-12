import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { createStaff, listStaff } from "./staff.service";
import { createStaffSchema } from "./staff.schemas";

export async function listStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const staff = await listStaff(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(staff)));
}

export async function createStaffHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff:manage");

  const input = validateBody(request, createStaffSchema);
  const staff = await createStaff(actor.schoolId, input);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "staff.created",
    resourceType: "staff",
    resourceId: staff.id,
  });

  reply.status(201).send(created(toCamelCase(staff)));
}
