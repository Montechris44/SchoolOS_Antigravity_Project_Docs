import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createActionHandler, listActionsHandler, updateActionHandler } from "./actions.controller";

export async function actionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/actions", { preHandler: authenticate }, listActionsHandler);
  app.post("/actions", { preHandler: authenticate }, createActionHandler);
  app.patch("/actions/:actionId", { preHandler: authenticate }, updateActionHandler);
}
