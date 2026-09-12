import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createAcademicSessionHandler, listAcademicSessionsHandler } from "./academic-sessions.controller";

export async function academicSessionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/academic-sessions", { preHandler: authenticate }, listAcademicSessionsHandler);
  app.post("/academic-sessions", { preHandler: authenticate }, createAcademicSessionHandler);
}
