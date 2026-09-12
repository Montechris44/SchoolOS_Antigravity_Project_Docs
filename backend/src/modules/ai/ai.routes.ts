import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { chatHandler } from "./ai.controller";

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ai/chat", { preHandler: authenticate }, chatHandler);
}
