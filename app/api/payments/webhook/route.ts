import { NextRequest, NextResponse } from "next/server";
import { paystackService } from "@/modules/payments/paystack-adapter";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    // If in live mode with valid secret, enforce HMAC SHA-512 check
    if (
      process.env.PAYSTACK_SECRET_KEY &&
      !process.env.PAYSTACK_SECRET_KEY.includes("mock")
    ) {
      const isValid = paystackService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Paystack webhook signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);

    if (event.event === "charge.success") {
      const data = event.data;
      const metadata = data.metadata || {};
      const schoolId = metadata.schoolId;
      const invoiceId = metadata.invoiceId;
      const amountInNaira = data.amount / 100; // Paystack gives amount in kobo

      if (!schoolId || !invoiceId) {
        return NextResponse.json(
          { error: "Webhook event missing essential metadata" },
          { status: 400 }
        );
      }

      const secCtx = {
        userId: "system_paystack_webhook",
        userSchoolId: schoolId,
        role: "owner" as const,
      };

      const result = paystackService.processVerifiedPayment(secCtx, {
        invoiceId,
        amountInNaira,
        providerReference: data.reference,
        payerName: metadata.payerName || data.customer?.email || "Parent",
        payerEmail: data.customer?.email,
        paymentMethod: "paystack",
      });

      return NextResponse.json({
        status: "success",
        isDuplicate: result.isDuplicate,
        receiptNumber: result.receipt.receiptNumber,
      });
    }

    return NextResponse.json({ status: "ignored_event", event: event.event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
