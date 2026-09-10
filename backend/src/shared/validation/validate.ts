import { FastifyRequest } from "fastify";
import { z } from "zod";

export function validateBody<TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema
): z.infer<TSchema> {
  return schema.parse(request.body);
}

export function validateParams<TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema
): z.infer<TSchema> {
  return schema.parse(request.params);
}

export function validateQuery<TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  schema: TSchema
): z.infer<TSchema> {
  return schema.parse(request.query);
}
