import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  bulkImportHandler,
  createPortalAccountHandler,
  createStudentHandler,
  getStudentHandler,
  listStudentsHandler,
  resetStudentPasswordHandler,
  studentSummaryHandler,
  updateStudentHandler,
  uploadStudentPhotoHandler,
} from "./students.controller";

export async function studentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/students", { preHandler: authenticate }, listStudentsHandler);
  app.post("/students", { preHandler: authenticate }, createStudentHandler);
  app.post("/students/bulk-import", { preHandler: authenticate }, bulkImportHandler);
  app.get("/students/:studentId", { preHandler: authenticate }, getStudentHandler);
  app.patch("/students/:studentId", { preHandler: authenticate }, updateStudentHandler);
  app.get("/students/:studentId/academic-summary", { preHandler: authenticate }, studentSummaryHandler);
  app.post("/students/:studentId/reset-password", { preHandler: authenticate }, resetStudentPasswordHandler);
  app.post("/students/:studentId/portal-account", { preHandler: authenticate }, createPortalAccountHandler);
  app.post("/students/:studentId/photo", { preHandler: authenticate }, uploadStudentPhotoHandler);
}
