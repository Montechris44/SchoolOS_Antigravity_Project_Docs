import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { loginHandler, meHandler, registerSchoolHandler } from "./auth.controller";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register-school", registerSchoolHandler);
  app.post("/auth/login", loginHandler);
  app.get("/me", { preHandler: authenticate }, meHandler);
}
