import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { createClass, listClasses } from "./classes.service";
import { createClassSchema } from "./classes.schemas";

export async function listClassesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:view");

  const classes = await listClasses(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(classes)));
}

export async function createClassHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "classes:manage");

  const input = validateBody(request, createClassSchema);
  const schoolClass = await createClass(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(schoolClass)));
}
