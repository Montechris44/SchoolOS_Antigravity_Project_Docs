import "fastify";

import { AuthenticatedUser } from "../middleware/auth";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}
