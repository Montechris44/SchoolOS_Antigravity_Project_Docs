import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  assignArmTeacherHandler,
  assignClassTeacherHandler,
  clearArmTeacherHandler,
  clearClassTeacherHandler,
  createArmHandler,
  createClassHandler,
  deleteArmHandler,
  deleteClassHandler,
  listClassesHandler,
  updateArmHandler,
} from "./classes.controller";

export async function classesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/classes", { preHandler: authenticate }, listClassesHandler);
  app.post("/classes", { preHandler: authenticate }, createClassHandler);
  app.delete("/classes/:classId", { preHandler: authenticate }, deleteClassHandler);
  app.patch("/classes/:classId/class-teacher", { preHandler: authenticate }, assignClassTeacherHandler);
  app.delete("/classes/:classId/class-teacher", { preHandler: authenticate }, clearClassTeacherHandler);

  app.post("/class-arms", { preHandler: authenticate }, createArmHandler);
  app.patch("/class-arms/:armId", { preHandler: authenticate }, updateArmHandler);
  app.delete("/class-arms/:armId", { preHandler: authenticate }, deleteArmHandler);
  app.patch("/class-arms/:armId/class-teacher", { preHandler: authenticate }, assignArmTeacherHandler);
  app.delete("/class-arms/:armId/class-teacher", { preHandler: authenticate }, clearArmTeacherHandler);
}
