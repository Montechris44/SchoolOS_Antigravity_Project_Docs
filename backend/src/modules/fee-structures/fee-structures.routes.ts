import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { listFeeStructuresHandler } from "./fee-structures.controller";

export async function feeStructuresRoutes(app: FastifyInstance): Promise<void> {
  app.get("/fee-structures", { preHandler: authenticate }, listFeeStructuresHandler);
}
