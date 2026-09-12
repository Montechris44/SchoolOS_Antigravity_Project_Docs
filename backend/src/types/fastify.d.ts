import "fastify";

import { AuthenticatedUser } from "../middleware/auth";
import { AuthenticatedSuperAdmin } from "../middleware/super-admin-auth";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
    currentSuperAdmin?: AuthenticatedSuperAdmin;
    rawBody?: string;
  }
}
