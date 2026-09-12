import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createClassHandler, listClassesHandler } from "./classes.controller";

export async function classesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/classes", { preHandler: authenticate }, listClassesHandler);
  app.post("/classes", { preHandler: authenticate }, createClassHandler);
}
