import { FastifyInstance } from "fastify";

import { getHealth } from "./health.controller";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", getHealth);
}
