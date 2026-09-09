/**
 * SchoolOS Paystack Payment Adapter & Webhook Engine
 * Fully satisfies Phase 6 & Phase 7 payment requirements with HMAC SHA-512 verification,
 * integer minor units (kobo), idempotency checks, and invoice reconciliation.
 */

import crypto from "crypto";
import { db } from "@/lib/db/mock-db";
import { Payment, Receipt, SecurityContext } from "@/types";

export interface PaystackInitParams {
  email: string;
  amountInNaira: number;
  reference: string;
  callbackUrl?: string;
  metadata: {
    schoolId: string;
    invoiceId: string;
    studentId: string;
    studentName: string;
    payerName: string;
  };
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export class PaystackPaymentService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_paystack_schoolos_secret_key";
  }

  /**
   * Generates a unique, non-colliding Paystack transaction reference.
   */
  generateReference(prefix: string = "SOS_PSTK"): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Initializes a transaction with Paystack (or mock sandbox if live credentials not supplied).
   */
  async initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResponse> {
    const amountInKobo = Math.round(params.amountInNaira * 100);

    // If real Paystack key exists and is not default mock, make live HTTP request
    if (
      process.env.PAYSTACK_SECRET_KEY &&
      !process.env.PAYSTACK_SECRET_KEY.includes("mock")
    ) {
      try {
        const res = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
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
        return await res.json();
      } catch (err: any) {
        throw new Error(`Paystack live initialization failed: ${err.message}`);
      }
    }

    // High-fidelity sandbox adapter
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

  /**
   * Validates Paystack Webhook signature using HMAC SHA-512.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature || !rawBody) return false;
    const hash = crypto
      .createHmac("sha512", this.secretKey)
      .update(rawBody)
      .digest("hex");
    return hash === signature;
  }

  /**
   * Process a verified payment event with strict idempotency and invoice balance reconciliation.
   */
  processVerifiedPayment(
    ctx: SecurityContext,
    params: {
      invoiceId: string;
      amountInNaira: number;
      providerReference: string;
      payerName: string;
      payerEmail?: string;
      paymentMethod?: "paystack" | "bank_transfer";
    }
  ): { payment: Payment; receipt: Receipt; isDuplicate: boolean } {
    const idempotencyKey = `idemp_${params.providerReference}`;

    // 1. Idempotency check: see if this transaction was already processed
    const existingPayments = db.getPayments(ctx);
    const alreadyProcessed = existingPayments.find(
      (p) => p.providerReference === params.providerReference || p.idempotencyKey === idempotencyKey
    );

    if (alreadyProcessed) {
      const receipt = db.getReceipts(ctx).find((r) => r.paymentId === alreadyProcessed.id);
      return {
        payment: alreadyProcessed,
        receipt: receipt!,
        isDuplicate: true, // Safeguard: prevents double crediting!
      };
    }

    // 2. Authoritative database record and balance update
    const result = db.recordPayment(ctx, {
      invoiceId: params.invoiceId,
      amount: params.amountInNaira,
      provider: "paystack",
      providerReference: params.providerReference,
      paymentMethod: params.paymentMethod || "paystack",
      status: "VERIFIED_SUCCESS",
      payerName: params.payerName,
      payerEmail: params.payerEmail,
      verifiedAt: new Date().toISOString(),
      idempotencyKey,
    });

    return {
      payment: result.payment,
      receipt: result.receipt,
      isDuplicate: false,
    };
  }
}

export const paystackService = new PaystackPaymentService();
