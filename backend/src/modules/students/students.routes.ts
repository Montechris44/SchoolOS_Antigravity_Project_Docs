import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createStudentHandler, getStudentHandler, listStudentsHandler } from "./students.controller";

export async function studentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/students", { preHandler: authenticate }, listStudentsHandler);
  app.get("/students/:studentId", { preHandler: authenticate }, getStudentHandler);
  app.post("/students", { preHandler: authenticate }, createStudentHandler);
}
