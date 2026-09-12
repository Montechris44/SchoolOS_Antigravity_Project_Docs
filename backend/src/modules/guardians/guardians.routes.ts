import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createGuardianHandler, listGuardiansHandler } from "./guardians.controller";

export async function guardiansRoutes(app: FastifyInstance): Promise<void> {
  app.get("/guardians", { preHandler: authenticate }, listGuardiansHandler);
  app.post("/guardians", { preHandler: authenticate }, createGuardianHandler);
}
