import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams } from "../../shared/validation/validate";
import { createAction, listActions, updateAction } from "./actions.service";
import { actionIdParamsSchema, createActionSchema, updateActionSchema } from "./actions.schemas";

export async function listActionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "actions:manage");

  const actions = await listActions(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(actions)));
}

export async function createActionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "actions:manage");

  const input = validateBody(request, createActionSchema);
  const action = await createAction(actor.schoolId, actor.userId, input);
  reply.status(201).send(created(toCamelCase(action)));
}

export async function updateActionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "actions:manage");

  const { actionId } = validateParams(request, actionIdParamsSchema);
  const input = validateBody(request, updateActionSchema);
  const action = await updateAction(actor.schoolId, actionId, input);
  reply.status(200).send(ok(toCamelCase(action)));
}
