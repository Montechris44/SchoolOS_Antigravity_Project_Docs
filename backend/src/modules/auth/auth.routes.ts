import { FastifyInstance } from "fastify";

import { authenticate, authenticateAllowPasswordChange } from "../../middleware/auth";
import {
  changePasswordHandler,
  forceUpdatePasswordHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutAllHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerSchoolHandler,
  resetPasswordHandler,
} from "./auth.controller";

// Credential endpoints get their own, much tighter, per-IP budget than the global limit.
const strictLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
const resetLimit = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register-school", strictLimit, registerSchoolHandler);
  app.post("/auth/login", strictLimit, loginHandler);
  app.post("/auth/refresh", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, refreshHandler);
  app.post("/auth/forgot-password", resetLimit, forgotPasswordHandler);
  app.post("/auth/reset-password", resetLimit, resetPasswordHandler);

  app.get("/me", { preHandler: authenticateAllowPasswordChange }, meHandler);
  app.post("/auth/logout", { preHandler: authenticateAllowPasswordChange }, logoutHandler);
  app.post("/auth/force-update-password", { ...strictLimit, preHandler: authenticateAllowPasswordChange }, forceUpdatePasswordHandler);
  app.post("/auth/change-password", { ...strictLimit, preHandler: authenticate }, changePasswordHandler);
  app.post("/auth/logout-all", { preHandler: authenticate }, logoutAllHandler);
}
