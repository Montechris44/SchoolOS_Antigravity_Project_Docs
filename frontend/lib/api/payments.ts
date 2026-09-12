import { Payment, Receipt } from "@/types";
import { apiRequest } from "./client";

export function listPayments(): Promise<Payment[]> {
  return apiRequest<Payment[]>("/payments");
}

export function listReceipts(): Promise<Receipt[]> {
  return apiRequest<Receipt[]>("/receipts");
}

export interface RecordManualPaymentPayload {
  invoiceId: string;
  amount: number;
  paymentMethod: "bank_transfer" | "pos" | "cash";
  payerName: string;
  payerEmail?: string;
}

export function recordManualPayment(payload: RecordManualPaymentPayload): Promise<Payment> {
  return apiRequest<Payment>("/payments/manual", { method: "POST", body: payload });
}

export interface SimulatePaystackWebhookPayload {
  reference: string;
  amountInNaira: number;
  schoolId: string;
  invoiceId: string;
  studentId: string;
  studentName: string;
  payerName: string;
  payerEmail: string;
}

export interface WebhookResult {
  status: string;
  isDuplicate?: boolean;
  receiptNumber?: string;
}

/**
 * Directly posts a Paystack-shaped `charge.success` event to the backend webhook
 * endpoint, standing in for what Paystack's own servers would send after a real
 * checkout. Used by the Payments page to demonstrate the verified-payment +
 * idempotency flow without a live Paystack account.
 */
export function simulatePaystackWebhook(payload: SimulatePaystackWebhookPayload): Promise<WebhookResult> {
  const body = {
    event: "charge.success",
    data: {
      reference: payload.reference,
      amount: Math.round(payload.amountInNaira * 100),
      status: "success",
      paid_at: new Date().toISOString(),
      customer: { email: payload.payerEmail },
      metadata: {
        schoolId: payload.schoolId,
        invoiceId: payload.invoiceId,
        studentId: payload.studentId,
        studentName: payload.studentName,
        payerName: payload.payerName,
      },
    },
  };

  return apiRequest<WebhookResult>("/payments/webhook", { method: "POST", body, auth: false });
}
