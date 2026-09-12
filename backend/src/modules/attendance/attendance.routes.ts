import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { listAttendanceHandler, markAttendanceHandler } from "./attendance.controller";

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/attendance", { preHandler: authenticate }, listAttendanceHandler);
  app.post("/attendance", { preHandler: authenticate }, markAttendanceHandler);
}
