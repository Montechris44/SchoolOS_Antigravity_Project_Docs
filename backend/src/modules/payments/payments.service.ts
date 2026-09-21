import crypto from "crypto";

import { PoolClient } from "pg";

import { env } from "../../config/env";
import { query, withTransaction } from "../../db/pool";
import { BadRequestError, NotFoundError } from "../../shared/http/errors";
import { FinanceActor, financeVisibility } from "../../shared/security/finance-scope";
import { RecordManualPaymentInput } from "./payments.schemas";

const DEFAULT_SANDBOX_SECRET = "sk_test_mock_paystack_schoolos_secret_key";

function getSecretKey(): string {
  return env.PAYSTACK_SECRET_KEY || DEFAULT_SANDBOX_SECRET;
}

function isLivePaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.includes("mock"));
}

const PAYMENT_SELECT = `
  SELECT p.id, p.school_id, p.invoice_id, p.receipt_number, p.amount, p.provider,
         p.provider_reference, p.payment_method, p.status, p.paid_at, p.payer_name,
         p.idempotency_key, p.created_at
  FROM payments p
`;

interface PaymentRecord {
  id: string;
  school_id: string;
  invoice_id: string;
  receipt_number: string;
  amount: number;
  provider: string;
  provider_reference: string;
  payment_method: string;
  status: string;
  paid_at: string;
  payer_name: string;
  idempotency_key: string;
  created_at: string;
}

export async function listPayments(schoolId: string, actor?: FinanceActor): Promise<PaymentRecord[]> {
  const params: unknown[] = [schoolId];
  const scope = actor
    ? financeVisibility(actor, params, "(SELECT i.student_id FROM invoices i WHERE i.id = p.invoice_id)")
    : "TRUE";
  const result = await query<PaymentRecord>(
    `${PAYMENT_SELECT} WHERE p.school_id = $1 AND ${scope} ORDER BY p.paid_at DESC`,
    params
  );
  return result.rows;
}

export async function listReceipts(schoolId: string, actor?: FinanceActor) {
  const params: unknown[] = [schoolId];
  const scope = actor ? financeVisibility(actor, params, "i.student_id") : "TRUE";
  const result = await query(
    `SELECT
       p.id, p.school_id, p.receipt_number, p.id AS payment_id, p.invoice_id,
       CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.admission_number,
       p.amount AS amount_paid, i.balance_due AS remaining_balance,
       p.paid_at AS payment_date, p.payment_method,
       COALESCE(pr.full_name, 'Paystack Gateway') AS received_by
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN students s ON s.id = i.student_id
     LEFT JOIN profiles pr ON pr.id = p.recorded_by_user_id
     WHERE p.school_id = $1 AND p.status = 'VERIFIED_SUCCESS' AND ${scope}
     ORDER BY p.paid_at DESC`,
    params
  );
  return result.rows;
}

function generateReceiptNumber(): string {
  return `RCT-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function applyPaymentToInvoice(client: PoolClient, invoiceId: string, amount: number): Promise<void> {
  await client.query(
    `UPDATE invoices
     SET amount_paid = amount_paid + $1,
         status = CASE
           WHEN amount_paid + $1 >= total_amount THEN 'PAID'
           WHEN amount_paid + $1 > 0 THEN 'PARTIAL'
           ELSE status
         END
     WHERE id = $2`,
    [amount, invoiceId]
  );
}

export async function recordManualPayment(
  schoolId: string,
  recordedByUserId: string,
  input: RecordManualPaymentInput
): Promise<PaymentRecord> {
  const invoiceResult = await query<{ id: string }>("SELECT id FROM invoices WHERE school_id = $1 AND id = $2", [
    schoolId,
    input.invoiceId,
  ]);

  if (invoiceResult.rowCount === 0) {
    throw new NotFoundError("Invoice not found.");
  }

  const receiptNumber = generateReceiptNumber();
  const idempotencyKey = `manual_${crypto.randomUUID()}`;
  const providerReference = idempotencyKey;

  const paymentId = await withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO payments (
         school_id, invoice_id, receipt_number, amount, provider, provider_reference,
         payment_method, status, payer_name, idempotency_key, recorded_by_user_id
       ) VALUES ($1, $2, $3, $4, 'manual', $5, $6, 'VERIFIED_SUCCESS', $7, $8, $9)
       RETURNING id`,
      [
        schoolId,
        input.invoiceId,
        receiptNumber,
        input.amount,
        providerReference,
        input.paymentMethod,
        input.payerName,
        idempotencyKey,
        recordedByUserId,
      ]
    );

    await applyPaymentToInvoice(client, input.invoiceId, input.amount);

    return result.rows[0].id;
  });

  const result = await query<PaymentRecord>(`${PAYMENT_SELECT} WHERE p.id = $1`, [paymentId]);
  return result.rows[0];
}

export function generatePaystackReference(prefix = "SOS_PSTK"): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

export interface PaystackInitParams {
  email: string;
  amountInNaira: number;
  reference: string;
  callbackUrl?: string;
  metadata: {
    schoolId: string;
    invoiceId: string;
    studentId?: string;
    studentName?: string;
    payerName?: string;
  };
}

export async function initializePaystackTransaction(params: PaystackInitParams) {
  const amountInKobo = Math.round(params.amountInNaira * 100);

  if (isLivePaystackConfigured()) {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: amountInKobo,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      throw new BadRequestError(`Paystack initialization failed with status ${response.status}.`);
    }

    return response.json();
  }

  // No live Paystack key configured — sandbox response so the checkout flow still works end to end.
  return {
    status: true,
    message: "Authorization URL created [Sandbox Mock Environment]",
    data: {
      authorization_url: `/payments?sim_ref=${params.reference}&amount=${params.amountInNaira}&invoiceId=${params.metadata.invoiceId}`,
      access_code: `acc_${crypto.randomBytes(6).toString("hex")}`,
      reference: params.reference,
    },
  };
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string): boolean {
  if (!signature || !rawBody) return false;
  const hash = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  return hash === signature;
}

interface WebhookChargeSuccessEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    customer?: { email?: string };
    metadata?: {
      schoolId?: string;
      invoiceId?: string;
      studentId?: string;
      studentName?: string;
      payerName?: string;
    };
  };
}

export async function processPaystackWebhook(
  rawBody: string,
  signature: string
): Promise<{ status: string; isDuplicate?: boolean; receiptNumber?: string }> {
  if (isLivePaystackConfigured() && !verifyPaystackWebhookSignature(rawBody, signature)) {
    throw new BadRequestError("Invalid Paystack webhook signature.");
  }

  const event = JSON.parse(rawBody) as WebhookChargeSuccessEvent;

  if (event.event !== "charge.success") {
    return { status: "ignored_event" };
  }

  const { data } = event;
  const schoolId = data.metadata?.schoolId;
  const invoiceId = data.metadata?.invoiceId;

  if (!schoolId || !invoiceId) {
    throw new BadRequestError("Webhook event missing essential metadata (schoolId, invoiceId).");
  }

  const amountInNaira = data.amount / 100;
  const payerName = data.metadata?.payerName || data.customer?.email || "Parent";

  const existing = await query<PaymentRecord>(
    `${PAYMENT_SELECT} WHERE p.school_id = $1 AND p.provider_reference = $2`,
    [schoolId, data.reference]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return { status: "success", isDuplicate: true, receiptNumber: existing.rows[0].receipt_number };
  }

  const invoiceResult = await query<{ id: string }>("SELECT id FROM invoices WHERE school_id = $1 AND id = $2", [
    schoolId,
    invoiceId,
  ]);

  if (invoiceResult.rowCount === 0) {
    throw new NotFoundError("Invoice referenced by webhook metadata was not found.");
  }

  const receiptNumber = generateReceiptNumber();

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO payments (
           school_id, invoice_id, receipt_number, amount, provider, provider_reference,
           payment_method, status, payer_name, idempotency_key
         ) VALUES ($1, $2, $3, $4, 'paystack', $5, 'paystack', 'VERIFIED_SUCCESS', $6, $7)`,
        [schoolId, invoiceId, receiptNumber, amountInNaira, data.reference, payerName, `idemp_${data.reference}`]
      );

      await applyPaymentToInvoice(client, invoiceId, amountInNaira);
    });
  } catch (error) {
    // Unique constraint on (school_id, provider_reference) protects against a concurrent duplicate delivery.
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      const dup = await query<PaymentRecord>(
        `${PAYMENT_SELECT} WHERE p.school_id = $1 AND p.provider_reference = $2`,
        [schoolId, data.reference]
      );
      return { status: "success", isDuplicate: true, receiptNumber: dup.rows[0]?.receipt_number };
    }
    throw error;
  }

  return { status: "success", isDuplicate: false, receiptNumber };
}
