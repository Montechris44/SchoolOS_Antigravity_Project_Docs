import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, { FastifyInstance } from "fastify";

import { env } from "./config/env";
import { registerErrorHandler } from "./shared/http/error-handler";
import { registerRoutes } from "./routes";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Preserve the raw JSON body alongside the parsed one so webhook handlers
  // (Paystack) can verify an HMAC signature computed over the exact bytes sent.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    request.rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.register(helmet);
  app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  registerErrorHandler(app);
  app.register(registerRoutes);

  return app;
}
