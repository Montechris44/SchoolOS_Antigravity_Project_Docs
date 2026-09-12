import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { createGuardian, listGuardians } from "./guardians.service";
import { createGuardianSchema } from "./guardians.schemas";

export async function listGuardiansHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:view");

  const guardians = await listGuardians(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(guardians)));
}

export async function createGuardianHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "students:manage");

  const input = validateBody(request, createGuardianSchema);
  const guardian = await createGuardian(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(guardian)));
}
