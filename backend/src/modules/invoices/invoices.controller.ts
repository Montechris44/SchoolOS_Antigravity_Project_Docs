import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateQuery } from "../../shared/validation/validate";
import { createInvoice, listInvoices } from "./invoices.service";
import { createInvoiceSchema, listInvoicesQuerySchema } from "./invoices.schemas";

export async function listInvoicesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "finance:view");

  const { studentId } = validateQuery(request, listInvoicesQuerySchema);
  const invoices = await listInvoices(actor.schoolId, studentId);
  reply.status(200).send(ok(toCamelCase(invoices)));
}

export async function createInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "finance:manage");

  const input = validateBody(request, createInvoiceSchema);
  const invoice = await createInvoice(actor.schoolId, input);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "invoice.issued",
    resourceType: "invoice",
    resourceId: invoice.id,
  });

  reply.status(201).send(created(toCamelCase(invoice)));
}
