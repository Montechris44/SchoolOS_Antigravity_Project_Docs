import { FastifyReply, FastifyRequest } from "fastify";

import { ok } from "../../shared/http/reply";
import { getHealthStatus } from "./health.service";

export async function getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const health = await getHealthStatus();
  reply.status(health.database.connected ? 200 : 503).send(ok(health));
}
