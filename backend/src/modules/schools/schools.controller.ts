import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requireSchoolPermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams } from "../../shared/validation/validate";
import { getSchoolById, updateSchool } from "./schools.service";
import { schoolIdParamsSchema, updateSchoolSchema } from "./schools.schemas";

export async function getSchoolHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { schoolId } = validateParams(request, schoolIdParamsSchema);
  requireSchoolPermission(actor, schoolId, "school:manage");

  const school = await getSchoolById(schoolId);
  reply.status(200).send(ok(toCamelCase(school)));
}

export async function updateSchoolHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { schoolId } = validateParams(request, schoolIdParamsSchema);
  requireSchoolPermission(actor, schoolId, "school:manage");

  const input = validateBody(request, updateSchoolSchema);
  const school = await updateSchool(schoolId, input);

  await recordAuditLog({
    schoolId,
    userId: actor.userId,
    action: "school.settings_updated",
    resourceType: "school",
    resourceId: schoolId,
    payload: input,
  });

  reply.status(200).send(ok(toCamelCase(school)));
}
