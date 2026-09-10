import { FastifyInstance } from "fastify";

import { healthRoutes } from "../modules/health/health.routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.register(healthRoutes);

  app.register(
    async (api) => {
      api.register(healthRoutes);
    },
    { prefix: "/api/v1" }
  );
}
