import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createTermHandler, listTermsHandler } from "./terms.controller";

export async function termsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/terms", { preHandler: authenticate }, listTermsHandler);
  app.post("/terms", { preHandler: authenticate }, createTermHandler);
}
