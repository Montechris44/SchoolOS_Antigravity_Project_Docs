import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createAssessmentHandler, listAssessmentsHandler } from "./assessments.controller";

export async function assessmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/assessments", { preHandler: authenticate }, listAssessmentsHandler);
  app.post("/assessments", { preHandler: authenticate }, createAssessmentHandler);
}
