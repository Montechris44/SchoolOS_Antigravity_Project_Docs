import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { listFeeStructures } from "./fee-structures.service";

export async function listFeeStructuresHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "finance:view");

  const feeStructures = await listFeeStructures(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(feeStructures)));
}
