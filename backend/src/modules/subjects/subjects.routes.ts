import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createSubjectHandler, listSubjectsHandler } from "./subjects.controller";

export async function subjectsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/subjects", { preHandler: authenticate }, listSubjectsHandler);
  app.post("/subjects", { preHandler: authenticate }, createSubjectHandler);
}
