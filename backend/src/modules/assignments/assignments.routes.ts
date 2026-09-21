import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { BadRequestError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { schoolFolder, uploadToStorage } from "../../shared/storage/cloudinary";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import {
  attachSubmissionFile,
  createAssignment,
  deleteAssignment,
  getMyAssignmentSummary,
  gradeSubmission,
  listAssignments,
  listMyAssignments,
  listSubmissions,
  updateMySubmission,
} from "./assignments.service";

const uuid = z.string().uuid();
const createSchema = z.object({
  classId: uuid,
  armId: uuid.nullish(),
  subjectId: uuid.nullish(),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullish(),
  points: z.number().int().min(1).max(1000).default(100),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date").nullish(),
});
const listSchema = z.object({ classId: uuid.optional() });
const idSchema = z.object({ assignmentId: uuid });
const gradeParams = z.object({ assignmentId: uuid, studentId: uuid });
const gradeBody = z.object({ gradeScore: z.number().min(0).max(1000), feedback: z.string().max(1000).nullish() });
const submissionBody = z.object({
  submissionText: z.string().max(10000).nullish(),
  status: z.enum(["IN_PROGRESS", "SUBMITTED"]).default("SUBMITTED"),
});

const guard = { preHandler: authenticate };

export async function assignmentsRoutes(app: FastifyInstance): Promise<void> {
  // Teachers and administrators
  app.get("/assignments", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "assignments:manage");
    reply.send(ok(toCamelCase(await listAssignments(actor, validateQuery(request, listSchema)))));
  });

  app.post("/assignments", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "assignments:manage");
    reply.status(201).send(created(toCamelCase(await createAssignment(actor, validateBody(request, createSchema)))));
  });

  // Static "my" routes are registered before the parametric ones.
  app.get("/assignments/my", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await listMyAssignments(actor))));
  });

  app.get("/assignments/my/summary", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await getMyAssignmentSummary(actor))));
  });

  app.patch("/assignments/my/:assignmentId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    const { assignmentId } = validateParams(request, idSchema);
    reply.send(ok(toCamelCase(await updateMySubmission(actor, assignmentId, validateBody(request, submissionBody)))));
  });

  app.post("/assignments/my/:assignmentId/files", { ...guard, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    const { assignmentId } = validateParams(request, idSchema);

    const file = await request.file();
    if (!file) throw new BadRequestError("Attach a file in the 'file' field.");
    const buffer = await file.toBuffer();
    const uploaded = await uploadToStorage(buffer, schoolFolder(actor.schoolId, "assignments"), "document");
    reply.status(201).send(
      created(
        await attachSubmissionFile(actor, assignmentId, {
          name: file.filename || "attachment",
          url: uploaded.url,
          mimeType: file.mimetype,
          publicId: uploaded.publicId,
          bytes: uploaded.bytes,
        })
      )
    );
  });

  app.delete("/assignments/:assignmentId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "assignments:manage");
    const { assignmentId } = validateParams(request, idSchema);
    await deleteAssignment(actor, assignmentId);
    reply.send(ok({ deleted: true }));
  });

  app.get("/assignments/:assignmentId/submissions", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "assignments:manage");
    const { assignmentId } = validateParams(request, idSchema);
    reply.send(ok(toCamelCase(await listSubmissions(actor, assignmentId))));
  });

  app.patch("/assignments/:assignmentId/submissions/:studentId/grade", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "assignments:manage");
    const { assignmentId, studentId } = validateParams(request, gradeParams);
    reply.send(ok(toCamelCase(await gradeSubmission(actor, assignmentId, studentId, validateBody(request, gradeBody)))));
  });
}
