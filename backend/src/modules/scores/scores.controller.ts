import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { listScores, recordScores } from "./scores.service";
import { listScoresQuerySchema, recordScoresSchema } from "./scores.schemas";

export async function listScoresHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");

  const { assessmentId } = validateQuery(request, listScoresQuerySchema);
  const scores = await listScores(actor.schoolId, assessmentId);
  reply.status(200).send(ok(toCamelCase(scores)));
}

export async function recordScoresHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");

  const input = validateBody(request, recordScoresSchema);
  const scores = await recordScores(actor.schoolId, actor.userId, input);
  reply.status(200).send(ok(toCamelCase(scores)));
}
