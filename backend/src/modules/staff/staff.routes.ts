import { FastifyInstance } from "fastify";
import { peopleImportRoutes } from "../school-settings/people-import.routes";

import { authenticate } from "../../middleware/auth";
import {
  createStaffHandler,
  deleteStaffHandler,
  getStaffHandler,
  listStaffHandler,
  resetStaffPasswordHandler,
  staffScheduleHandler,
  toggleStaffHandler,
  updateStaffHandler,
} from "./staff.controller";

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  await peopleImportRoutes(app, "teacher");
  app.get("/staff", { preHandler: authenticate }, listStaffHandler);
  app.post("/staff", { preHandler: authenticate }, createStaffHandler);
  app.get("/staff/:userId", { preHandler: authenticate }, getStaffHandler);
  app.patch("/staff/:userId", { preHandler: authenticate }, updateStaffHandler);
  app.patch("/staff/:userId/toggle", { preHandler: authenticate }, toggleStaffHandler);
  app.delete("/staff/:userId", { preHandler: authenticate }, deleteStaffHandler);
  app.post("/staff/:userId/reset-password", { preHandler: authenticate }, resetStaffPasswordHandler);
  app.get("/staff/:userId/schedule", { preHandler: authenticate }, staffScheduleHandler);
}
