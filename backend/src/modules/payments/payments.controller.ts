import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { NotFoundError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import {
  generatePaystackReference,
  initializePaystackTransaction,
  listPayments,
  listReceipts,
  processPaystackWebhook,
  recordManualPayment,
} from "./payments.service";
import { initializePaystackSchema, recordManualPaymentSchema } from "./payments.schemas";

export async function listPaymentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "finance:view");

  const payments = await listPayments(actor.schoolId, actor);
  reply.status(200).send(ok(toCamelCase(payments)));
}

export async function listReceiptsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "finance:view");

  const receipts = await listReceipts(actor.schoolId, actor);
  reply.status(200).send(ok(toCamelCase(receipts)));
}

export async function recordManualPaymentHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "payments:record");

  const input = validateBody(request, recordManualPaymentSchema);
  const payment = await recordManualPayment(actor.schoolId, actor.userId, input);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "payment.recorded_manual",
    resourceType: "payment",
    resourceId: payment.id,
  });

  reply.status(201).send(created(toCamelCase(payment)));
}

export async function initializePaystackHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "payments:record");

  const input = validateBody(request, initializePaystackSchema);

  const invoiceResult = await query<{ id: string; student_id: string }>(
    "SELECT id, student_id FROM invoices WHERE school_id = $1 AND id = $2",
    [actor.schoolId, input.invoiceId]
  );

  if (invoiceResult.rowCount === 0) {
    throw new NotFoundError("Invoice not found.");
  }

  const reference = generatePaystackReference();
  const response = await initializePaystackTransaction({
    email: input.email,
    amountInNaira: input.amountInNaira,
    reference,
    callbackUrl: input.callbackUrl,
    metadata: {
      schoolId: actor.schoolId,
      invoiceId: input.invoiceId,
      studentId: invoiceResult.rows[0].student_id,
    },
  });

  reply.status(200).send(ok(response));
}

export async function paystackWebhookHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const signature = (request.headers["x-paystack-signature"] as string) || "";
  const result = await processPaystackWebhook(request.rawBody ?? "", signature);
  reply.status(200).send(result);
}
