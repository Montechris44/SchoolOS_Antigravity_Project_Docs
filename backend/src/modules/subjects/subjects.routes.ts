import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  addFromCatalogHandler,
  createSubjectHandler,
  listCatalogHandler,
  listSubjectsHandler,
  toggleSubjectHandler,
  updateSubjectHandler,
} from "./subjects.controller";

export async function subjectsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/subjects", { preHandler: authenticate }, listSubjectsHandler);
  app.post("/subjects", { preHandler: authenticate }, createSubjectHandler);
  app.get("/subjects/catalog", { preHandler: authenticate }, listCatalogHandler);
  app.post("/subjects/from-catalog", { preHandler: authenticate }, addFromCatalogHandler);
  app.patch("/subjects/:subjectId", { preHandler: authenticate }, updateSubjectHandler);
  app.patch("/subjects/:subjectId/toggle", { preHandler: authenticate }, toggleSubjectHandler);
}
