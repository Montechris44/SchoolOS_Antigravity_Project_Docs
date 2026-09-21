import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  approvalMetricsHandler,
  approvalQueueHandler,
  approveBatchHandler,
  batchDetailHandler,
  classTeacherOverviewHandler,
  classTeacherPublishHandler,
  classTeacherReturnHandler,
  classTeacherSheetHandler,
  enterScoresHandler,
  entrySheetHandler,
  getSchemeHandler,
  myClassesHandler,
  myResultsHandler,
  publishClassHandler,
  publishReadinessHandler,
  publishSubjectHandler,
  publishedResultsHandler,
  reportCardHandler,
  returnBatchHandler,
  staffResultHandler,
  upsertSchemeHandler,
} from "./results.controller";

export async function resultsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: authenticate };

  // Subject teacher
  app.get("/results/my-classes", guard, myClassesHandler);
  app.get("/results/ca-scheme", guard, getSchemeHandler);
  app.post("/results/ca-scheme", guard, upsertSchemeHandler);
  app.get("/results/entry-sheet", guard, entrySheetHandler);
  app.post("/results/scores", guard, enterScoresHandler);
  app.post("/results/publish-to-class-teacher", guard, publishSubjectHandler);

  // Class teacher
  app.get("/results/class-teacher-overview", guard, classTeacherOverviewHandler);
  app.get("/results/class-teacher-subject-sheet", guard, classTeacherSheetHandler);
  app.post("/results/class-teacher-return", guard, classTeacherReturnHandler);
  app.post("/results/class-teacher-publish", guard, classTeacherPublishHandler);

  // School administrator
  app.get("/results/approval-queue", guard, approvalQueueHandler);
  app.get("/results/approval-queue/metrics", guard, approvalMetricsHandler);
  app.get("/results/approval-queue/publish-readiness", guard, publishReadinessHandler);
  app.post("/results/approval-queue/publish-class", guard, publishClassHandler);
  app.get("/results/approval-queue/:batchId", guard, batchDetailHandler);
  app.post("/results/approval-queue/:batchId/approve", guard, approveBatchHandler);
  app.post("/results/approval-queue/:batchId/return", guard, returnBatchHandler);

  // Students, parents and staff reading results
  app.get("/results/my", guard, myResultsHandler);
  app.get("/results/published/:studentId", guard, publishedResultsHandler);
  app.get("/results/students/:studentId/terms/:termId", guard, staffResultHandler);
  app.get("/results/report-card", guard, reportCardHandler);
  app.get("/student/report-card", guard, reportCardHandler);
}
