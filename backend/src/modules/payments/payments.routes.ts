import { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/auth";
import {
  initializePaystackHandler,
  listPaymentsHandler,
  listReceiptsHandler,
  paystackWebhookHandler,
  recordManualPaymentHandler,
} from "./payments.controller";

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/payments", { preHandler: authenticate }, listPaymentsHandler);
  app.get("/receipts", { preHandler: authenticate }, listReceiptsHandler);
  app.post("/payments/manual", { preHandler: authenticate }, recordManualPaymentHandler);
  app.post("/payments/initialize", { preHandler: authenticate }, initializePaystackHandler);
  // Called by Paystack's servers directly — no user session, verified via HMAC signature instead.
  app.post("/payments/webhook", paystackWebhookHandler);
}
