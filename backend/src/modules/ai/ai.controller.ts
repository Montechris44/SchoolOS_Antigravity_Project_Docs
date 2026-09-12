import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { chat } from "./ai.service";
import { chatSchema } from "./ai.schemas";

export async function chatHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "ai:query");

  const { prompt } = validateBody(request, chatSchema);
  const result = await chat(actor, prompt);
  reply.status(200).send(ok(result));
}
