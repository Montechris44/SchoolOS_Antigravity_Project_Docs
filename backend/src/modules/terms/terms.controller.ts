import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { createTerm, listTerms } from "./terms.service";
import { createTermSchema, listTermsQuerySchema } from "./terms.schemas";

export async function listTermsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const { sessionId } = validateQuery(request, listTermsQuerySchema);
  const terms = await listTerms(actor.schoolId, sessionId);
  reply.status(200).send(ok(toCamelCase(terms)));
}

export async function createTermHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "school:manage");

  const input = validateBody(request, createTermSchema);
  const term = await createTerm(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(term)));
}
