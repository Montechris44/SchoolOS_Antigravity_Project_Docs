import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { getSchoolHealthHandler, listSignalsHandler } from "./intelligence.controller";

export async function intelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/intelligence/signals", { preHandler: authenticate }, listSignalsHandler);
  app.get("/intelligence/health", { preHandler: authenticate }, getSchoolHealthHandler);
}
