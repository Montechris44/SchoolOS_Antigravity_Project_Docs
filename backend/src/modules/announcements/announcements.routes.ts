import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { dispatchAnnouncementHandler, listAnnouncementsHandler } from "./announcements.controller";

export async function announcementsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/announcements", { preHandler: authenticate }, listAnnouncementsHandler);
  app.post("/announcements", { preHandler: authenticate }, dispatchAnnouncementHandler);
}
