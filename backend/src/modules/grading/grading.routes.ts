import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { gradeForScore, listGradeBands, replaceGradeBands } from "./grading.service";

const bandSchema = z.object({
  minScore: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  grade: z.string().min(1).max(5),
  remark: z.string().max(50).nullish(),
  isPass: z.boolean().default(true),
});
const replaceSchema = z.object({ bands: z.array(bandSchema).min(2).max(20) });
const previewSchema = z.object({ score: z.coerce.number().min(0).max(100) });

async function listHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  reply.status(200).send(ok(toCamelCase(await listGradeBands(actor.schoolId))));
}

async function replaceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "grading:manage");

  const { bands } = validateBody(request, replaceSchema);
  reply.status(200).send(ok(toCamelCase(await replaceGradeBands(actor.schoolId, actor.userId, bands))));
}

async function previewHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { score } = validateQuery(request, previewSchema);
  reply.status(200).send(ok(await gradeForScore(actor.schoolId, score)));
}

export async function gradingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/grading-system", { preHandler: authenticate }, listHandler);
  app.put("/grading-system", { preHandler: authenticate }, replaceHandler);
  app.get("/grading-system/preview", { preHandler: authenticate }, previewHandler);
}
