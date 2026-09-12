import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { calculateSchoolHealth, evaluateSignals } from "./intelligence.service";

export async function listSignalsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "intelligence:view");

  const signals = await evaluateSignals(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(signals)));
}

export async function getSchoolHealthHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "intelligence:view");

  const health = await calculateSchoolHealth(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(health)));
}
