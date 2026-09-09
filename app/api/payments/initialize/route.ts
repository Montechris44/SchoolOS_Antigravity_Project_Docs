import { NextRequest, NextResponse } from "next/server";
import { paystackService } from "@/modules/payments/paystack-adapter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, amountInNaira, invoiceId, studentId, studentName, payerName, schoolId } = body;

    if (!email || !amountInNaira || !invoiceId || !schoolId) {
      return NextResponse.json(
        { error: "Missing required payment fields (email, amount, invoiceId, schoolId)" },
        { status: 400 }
      );
    }

    const reference = paystackService.generateReference();

    const response = await paystackService.initializeTransaction({
      email,
      amountInNaira,
      reference,
      metadata: {
        schoolId,
        invoiceId,
        studentId: studentId || "",
        studentName: studentName || "",
        payerName: payerName || email,
      },
    });

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
