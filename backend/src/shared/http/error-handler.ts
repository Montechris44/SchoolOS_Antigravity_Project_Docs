import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { AppError } from "./errors";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        error: "ValidationError",
        message: "Request validation failed.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
      });
      return;
    }

    request.log.error(error);
    reply.status(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred.",
    });
  });
}
