import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { createAssessment, listAssessments } from "./assessments.service";
import { createAssessmentSchema, listAssessmentsQuerySchema } from "./assessments.schemas";

export async function listAssessmentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");

  const { classId, subjectId } = validateQuery(request, listAssessmentsQuerySchema);
  const assessments = await listAssessments(actor.schoolId, classId, subjectId);
  reply.status(200).send(ok(toCamelCase(assessments)));
}

export async function createAssessmentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");

  const input = validateBody(request, createAssessmentSchema);
  const assessment = await createAssessment(actor.schoolId, input);
  reply.status(201).send(created(toCamelCase(assessment)));
}
