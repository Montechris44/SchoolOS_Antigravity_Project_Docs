import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  academicStatusHandler,
  createAcademicSessionHandler,
  deactivateTermHandler,
  listAcademicSessionsHandler,
  reactivateTermHandler,
  setCurrentSessionHandler,
  setCurrentTermHandler,
} from "./academic-sessions.controller";

export async function academicSessionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/academic-sessions", { preHandler: authenticate }, listAcademicSessionsHandler);
  app.post("/academic-sessions", { preHandler: authenticate }, createAcademicSessionHandler);
  app.patch("/academic-sessions/:sessionId/set-current", { preHandler: authenticate }, setCurrentSessionHandler);

  app.get("/academic-status", { preHandler: authenticate }, academicStatusHandler);
  app.patch("/terms/:termId/set-current", { preHandler: authenticate }, setCurrentTermHandler);
  app.patch("/terms/:termId/deactivate", { preHandler: authenticate }, deactivateTermHandler);
  app.patch("/terms/:termId/reactivate", { preHandler: authenticate }, reactivateTermHandler);
}
