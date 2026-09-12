const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

// 1. Balance Calculation Logic
function calculateInvoiceBalance(totalAmount, amountPaid) {
  return Math.max(0, totalAmount - amountPaid);
}

// 2. Paystack HMAC SHA-512 Signature Verification
function verifyPaystackSignature(payload, signature, secret) {
  const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex");
  return hash === signature;
}

// 3. Idempotent Payment Processor Mock
function createPaymentProcessor() {
  const payments = [];
  const invoices = {
    "inv_001": { id: "inv_001", totalAmount: 185000, amountPaid: 0, balanceDue: 185000, status: "OVERDUE" },
  };

  function processPaymentWebhook({ reference, invoiceId, amount, status }) {
    // Check if duplicate
    const existing = payments.find((p) => p.reference === reference);
    if (existing) {
      return { success: true, isDuplicate: true, invoice: invoices[invoiceId] };
    }

    if (status !== "VERIFIED_SUCCESS") {
      return { success: false, isDuplicate: false, invoice: invoices[invoiceId] };
    }

    // Record verified transaction
    payments.push({ reference, invoiceId, amount, status });

    // Update invoice balance
    const inv = invoices[invoiceId];
    inv.amountPaid += amount;
    inv.balanceDue = calculateInvoiceBalance(inv.totalAmount, inv.amountPaid);
    inv.status = inv.balanceDue === 0 ? "PAID" : "PARTIAL";

    return { success: true, isDuplicate: false, invoice: inv };
  }

  return { processPaymentWebhook, getInvoice: (id) => invoices[id], getPayments: () => payments };
}

test("Finance: Balance correctly calculated from authoritative payments", () => {
  assert.strictEqual(calculateInvoiceBalance(185000, 0), 185000);
  assert.strictEqual(calculateInvoiceBalance(185000, 85000), 100000);
  assert.strictEqual(calculateInvoiceBalance(185000, 185000), 0);
  assert.strictEqual(calculateInvoiceBalance(185000, 200000), 0); // never negative
});

test("Paystack: Validates webhook HMAC SHA-512 signature", () => {
  const secret = "sk_test_paystack_secret_12345";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_100", amount: 50000 } });
  const validSignature = crypto.createHmac("sha512", secret).update(body).digest("hex");

  assert.strictEqual(verifyPaystackSignature(body, validSignature, secret), true);
  assert.strictEqual(verifyPaystackSignature(body, "invalid_signature_xyz", secret), false);
});

test("Payments Idempotency: Duplicate webhook does not duplicate money", () => {
  const processor = createPaymentProcessor();

  // First webhook delivery
  const res1 = processor.processPaymentWebhook({
    reference: "pstk_tx_abc_123",
    invoiceId: "inv_001",
    amount: 100000,
    status: "VERIFIED_SUCCESS",
  });

  assert.strictEqual(res1.isDuplicate, false);
  assert.strictEqual(res1.invoice.amountPaid, 100000);
  assert.strictEqual(res1.invoice.balanceDue, 85000);
  assert.strictEqual(res1.invoice.status, "PARTIAL");

  // Duplicate webhook delivery with identical reference
  const res2 = processor.processPaymentWebhook({
    reference: "pstk_tx_abc_123",
    invoiceId: "inv_001",
    amount: 100000,
    status: "VERIFIED_SUCCESS",
  });

  assert.strictEqual(res2.isDuplicate, true);
  // Invariants MUST hold: balance and paid amount have NOT changed!
  assert.strictEqual(res2.invoice.amountPaid, 100000);
  assert.strictEqual(res2.invoice.balanceDue, 85000);
  assert.strictEqual(processor.getPayments().length, 1);
});
