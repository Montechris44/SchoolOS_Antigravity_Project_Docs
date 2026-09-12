import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { getSchoolHandler, updateSchoolHandler } from "./schools.controller";

export async function schoolsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/schools/:schoolId", { preHandler: authenticate }, getSchoolHandler);
  app.patch("/schools/:schoolId", { preHandler: authenticate }, updateSchoolHandler);
}
