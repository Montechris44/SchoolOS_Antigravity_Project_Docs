import { FastifyInstance } from "fastify";

import { authenticateSuperAdmin } from "../../middleware/super-admin-auth";
import {
  getAnalyticsHandler,
  getSchoolHandler,
  listAuditLogsHandler,
  listSchoolsHandler,
  listUsersHandler,
  loginHandler,
  meHandler,
  unlockProfileHandler,
  updateSchoolStatusHandler,
} from "./super-admin.controller";

export async function superAdminRoutes(app: FastifyInstance): Promise<void> {
  app.post("/super-admin/auth/login", loginHandler);

  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("onRequest", authenticateSuperAdmin);

    protectedRoutes.get("/super-admin/me", meHandler);
    protectedRoutes.get("/super-admin/schools", listSchoolsHandler);
    protectedRoutes.get("/super-admin/schools/:schoolId", getSchoolHandler);
    protectedRoutes.patch("/super-admin/schools/:schoolId/status", updateSchoolStatusHandler);
    protectedRoutes.get("/super-admin/users", listUsersHandler);
    protectedRoutes.post("/super-admin/profiles/:profileId/unlock", unlockProfileHandler);
    protectedRoutes.get("/super-admin/analytics", getAnalyticsHandler);
    protectedRoutes.get("/super-admin/audit-logs", listAuditLogsHandler);
  });
}
