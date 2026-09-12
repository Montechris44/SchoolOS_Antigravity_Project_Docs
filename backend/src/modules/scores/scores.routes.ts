import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { listScoresHandler, recordScoresHandler } from "./scores.controller";

export async function scoresRoutes(app: FastifyInstance): Promise<void> {
  app.get("/scores", { preHandler: authenticate }, listScoresHandler);
  app.post("/scores", { preHandler: authenticate }, recordScoresHandler);
}
