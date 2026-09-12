import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import { createInvoiceHandler, listInvoicesHandler } from "./invoices.controller";

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/invoices", { preHandler: authenticate }, listInvoicesHandler);
  app.post("/invoices", { preHandler: authenticate }, createInvoiceHandler);
}
