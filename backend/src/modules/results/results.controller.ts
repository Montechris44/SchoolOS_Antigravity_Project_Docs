import { FastifyReply, FastifyRequest } from "fastify";

import { AuthenticatedUser, getAuthContext } from "../../middleware/auth";
import { getCurrentPeriod } from "../../shared/academics/period";
import { toCamelCase } from "../../shared/http/case";
import { ForbiddenError } from "../../shared/http/errors";
import { ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { getReportCard } from "./report-cards.service";
import { getMyPublishedResults, getPublishedResults, getStaffResult, resolveStudentIdForReport } from "./results.read.service";
import {
  batchIdParamsSchema,
  classTeacherOverviewQuerySchema,
  classTeacherPublishSchema,
  classTeacherReturnSchema,
  classTeacherSheetQuerySchema,
  enterScoresSchema,
  entrySheetQuerySchema,
  publishClassSchema,
  queueQuerySchema,
  readinessQuerySchema,
  reportCardQuerySchema,
  returnBatchSchema,
  schemeQuerySchema,
  scopeSchema,
  studentIdParamsSchema,
  studentResultQuerySchema,
  studentTermParamsSchema,
  upsertSchemeSchema,
} from "./results.schemas";
import {
  Actor,
  approveSubjectBatch,
  classTeacherPublishToAdmin,
  classTeacherReturnSubject,
  enterScores,
  getApprovalBatchDetail,
  getApprovalQueue,
  getApprovalQueueMetrics,
  getClassPublishReadiness,
  getClassTeacherOverview,
  getClassTeacherSubjectSheet,
  getEntrySheet,
  getScheme,
  listMyClasses,
  publishClassWhenAllApproved,
  publishSubjectToClassTeacher,
  returnSubjectBatch,
  upsertScheme,
} from "./results.workflow.service";

function scoreEntryActor(request: FastifyRequest): Actor {
  const actor = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");
  return { userId: actor.userId, schoolId: actor.schoolId, role: actor.role };
}

function reviewActor(request: FastifyRequest): Actor {
  const actor = getAuthContext(request);
  requirePermission(actor, "results:review");
  return { userId: actor.userId, schoolId: actor.schoolId, role: actor.role };
}

// ---- Teacher ---------------------------------------------------------------

export async function myClassesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(200).send(ok(toCamelCase(await listMyClasses(scoreEntryActor(request)))));
}

export async function getSchemeHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const params = validateQuery(request, schemeQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getScheme(actor.schoolId, params))));
}

export async function upsertSchemeHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const input = validateBody(request, upsertSchemeSchema);
  reply.status(200).send(ok(toCamelCase(await upsertScheme(actor, input))));
}

export async function enterScoresHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const input = validateBody(request, enterScoresSchema);
  reply.status(200).send(ok(toCamelCase(await enterScores(actor, input))));
}

export async function publishSubjectHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const scope = validateBody(request, scopeSchema);
  reply.status(200).send(ok(toCamelCase(await publishSubjectToClassTeacher(actor, scope))));
}

export async function entrySheetHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const scope = validateQuery(request, entrySheetQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getEntrySheet(actor, scope))));
}

// ---- Class teacher ---------------------------------------------------------

export async function classTeacherOverviewHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const params = validateQuery(request, classTeacherOverviewQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getClassTeacherOverview(actor, params))));
}

export async function classTeacherSheetHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const params = validateQuery(request, classTeacherSheetQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getClassTeacherSubjectSheet(actor, params))));
}

export async function classTeacherReturnHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const input = validateBody(request, classTeacherReturnSchema);
  reply.status(200).send(ok(toCamelCase(await classTeacherReturnSubject(actor, input))));
}

export async function classTeacherPublishHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = scoreEntryActor(request);
  const input = validateBody(request, classTeacherPublishSchema);
  reply.status(200).send(ok(toCamelCase(await classTeacherPublishToAdmin(actor, input))));
}

// ---- School administrator --------------------------------------------------

export async function approvalQueueHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const params = validateQuery(request, queueQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getApprovalQueue(actor.schoolId, params))));
}

export async function approvalMetricsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const params = validateQuery(request, queueQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getApprovalQueueMetrics(actor.schoolId, params))));
}

export async function publishReadinessHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const params = validateQuery(request, readinessQuerySchema);
  reply
    .status(200)
    .send(ok(await getClassPublishReadiness(actor.schoolId, params.classId, params.armId ?? null, params.termId, params.sessionId)));
}

export async function batchDetailHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const { batchId } = validateParams(request, batchIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await getApprovalBatchDetail(actor.schoolId, batchId))));
}

export async function approveBatchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const { batchId } = validateParams(request, batchIdParamsSchema);
  reply.status(200).send(ok(toCamelCase(await approveSubjectBatch(actor.schoolId, actor.userId, batchId))));
}

export async function returnBatchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const { batchId } = validateParams(request, batchIdParamsSchema);
  const { reviewNotes } = validateBody(request, returnBatchSchema);
  reply.status(200).send(ok(toCamelCase(await returnSubjectBatch(actor.schoolId, actor.userId, batchId, reviewNotes))));
}

export async function publishClassHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = reviewActor(request);
  const input = validateBody(request, publishClassSchema);
  reply.status(200).send(ok(toCamelCase(await publishClassWhenAllApproved(actor.schoolId, actor.userId, input))));
}

// ---- Reading results -------------------------------------------------------

export async function myResultsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requireRole(actor, ["student"]);
  const params = validateQuery(request, studentResultQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getMyPublishedResults(actor, params))));
}

export async function publishedResultsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { studentId } = validateParams(request, studentIdParamsSchema);
  const params = validateQuery(request, studentResultQuerySchema);
  reply.status(200).send(ok(toCamelCase(await getPublishedResults(actor, studentId, params))));
}

/** Administrators and the class's teachers may look at any status, e.g. to review before release. */
export async function staffResultHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor: AuthenticatedUser = getAuthContext(request);
  requirePermission(actor, "academics:enter_scores");
  const { studentId } = validateParams(request, studentIdParamsSchema);
  const { termId } = validateParams(request, studentTermParamsSchema);
  reply.status(200).send(ok(toCamelCase(await getStaffResult(actor, studentId, termId))));
}

export async function reportCardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { termId, studentId } = validateQuery(request, reportCardQuerySchema);
  const resolvedStudentId = await resolveStudentIdForReport(actor, studentId);
  const resolvedTermId = termId ?? (await getCurrentPeriod(actor.schoolId)).termId;
  if (!resolvedTermId) throw new ForbiddenError("No academic term is configured yet.");

  // Parents, students and teachers only ever get a card built from a published result.
  reply.status(200).send(ok(toCamelCase(await getReportCard(actor.schoolId, resolvedStudentId, resolvedTermId))));
}

