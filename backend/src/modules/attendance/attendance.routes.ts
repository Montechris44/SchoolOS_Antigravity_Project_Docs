import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  listAttendanceHandler,
  markAttendanceHandler,
  myAttendanceHandler,
  overviewHandler,
  ratesHandler,
  rosterHandler,
  studentAttendanceHandler,
} from "./attendance.controller";

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/attendance", { preHandler: authenticate }, listAttendanceHandler);
  app.post("/attendance", { preHandler: authenticate }, markAttendanceHandler);
  app.get("/attendance/roster", { preHandler: authenticate }, rosterHandler);
  app.get("/attendance/overview", { preHandler: authenticate }, overviewHandler);
  app.get("/attendance/rates", { preHandler: authenticate }, ratesHandler);
  app.get("/attendance/me", { preHandler: authenticate }, myAttendanceHandler);
  app.get("/attendance/students/:studentId", { preHandler: authenticate }, studentAttendanceHandler);
}
