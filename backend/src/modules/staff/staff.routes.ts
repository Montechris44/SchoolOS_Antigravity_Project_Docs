import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createStaffHandler, listStaffHandler } from "./staff.controller";

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  app.get("/staff", { preHandler: authenticate }, listStaffHandler);
  app.post("/staff", { preHandler: authenticate }, createStaffHandler);
}
