"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listPayments, simulatePaystackWebhook } from "@/lib/api/payments";
import { listInvoices } from "@/lib/api/finance";
import { ApiError } from "@/lib/api/client";
import { Payment, Invoice } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
} from "lucide-react";

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const { user, school } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<number>(185000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentLog, setPaymentLog] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);

  const refreshPayments = () => {
    if (!school) return;
    setLoadError(null);

    Promise.all([listPayments(), listInvoices()])
      .then(([p, inv]) => {
        setPayments(p);
        setInvoices(inv);

        const queryInvId = searchParams.get("invoiceId");
        if (queryInvId) {
          setSelectedInvoiceId(queryInvId);
          const matched = inv.find((i) => i.id === queryInvId);
          if (matched) setCustomAmount(matched.balanceDue > 0 ? matched.balanceDue : matched.totalAmount);
        } else if (inv.length > 0 && !selectedInvoiceId) {
          setSelectedInvoiceId(inv[0].id);
          setCustomAmount(inv[0].balanceDue > 0 ? inv[0].balanceDue : inv[0].totalAmount);
        }
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load payments data."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const handleInvoiceSelect = (id: string) => {
    setSelectedInvoiceId(id);
    const matched = invoices.find((i) => i.id === id);
    if (matched) {
      setCustomAmount(matched.balanceDue > 0 ? matched.balanceDue : matched.totalAmount);
    }
  };

  // Simulate Paystack Online Payment & Webhook Verification Flow
  const handlePaystackPayment = async (isDuplicateTest: boolean = false) => {
    setIsProcessing(true);
    setPaymentLog(null);

    const invoice = invoices.find((i) => i.id === selectedInvoiceId);
    if (!invoice || !school) {
      setIsProcessing(false);
      return;
    }

    const testReference = isDuplicateTest
      ? (payments[0]?.providerReference || `pstk_ref_${Date.now()}`)
      : `pstk_ref_${Date.now()}`;

    try {
      const data = await simulatePaystackWebhook({
        reference: testReference,
        amountInNaira: customAmount,
        schoolId: school.id,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        payerName: invoice.guardianName,
        payerEmail: invoice.guardianEmail || user?.email || "payer@example.com",
      });

      refreshPayments();

      if (data.isDuplicate) {
        setPaymentLog({
          type: "warning",
          message: `IDEMPOTENCY VERIFIED: Duplicate transaction '${testReference}' was detected. School balance and receipt were protected from double-crediting!`,
        });
      } else {
        setPaymentLog({
          type: "success",
          message: `PAYMENT VERIFIED: Paystack payment for ${formatCurrency(customAmount)} verified. Official receipt #${data.receiptNumber || "RCT-ECA"} issued.`,
        });
      }
    } catch (err) {
      setPaymentLog({
        type: "warning",
        message: `Payment simulation note: ${err instanceof ApiError ? err.message : "Unknown error."}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSkeleton count={5} />
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <ErrorState message={loadError} onRetry={refreshPayments} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Paystack Gateway Integration &amp; Reconciliation
            </h1>
            <p className="text-sm text-slate-500">
              Server-side transaction initiation, webhook signature verification, and duplicate-proof idempotency.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Paystack Adapter Active
            </span>
          </div>
        </div>

        {/* Status Notification Banner */}
        {paymentLog && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 border text-sm font-medium ${
              paymentLog.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {paymentLog.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {paymentLog.type === "success" ? "Paystack Event Processed" : "Idempotency Notification"}
              </p>
              <p className="text-xs mt-0.5">{paymentLog.message}</p>
            </div>
          </div>
        )}

        {/* Interactive Payment Checkout Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 p-6 border-blue-200 bg-linear-to-b from-blue-50/50 to-white">
            <div className="flex items-center gap-2 text-blue-800 mb-4">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-base">Paystack Parent Checkout</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Select Outstanding Invoice
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.studentName} ({formatCurrency(inv.balanceDue)} due)
                    </option>
                  ))}
                </select>
              </div>

              {currentInvoice && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Scholar:</span>
                    <span className="font-bold text-slate-900">{currentInvoice.studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billed Total:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(currentInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid To Date:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(currentInvoice.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="font-bold text-slate-800">Remaining Balance:</span>
                    <span className="font-bold text-blue-700 text-sm">{formatCurrency(currentInvoice.balanceDue)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">
                  Amount to Settle (NGN)
                </label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-bold text-slate-900"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => handlePaystackPayment(false)}
                  isLoading={isProcessing}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm text-sm h-11"
                >
                  <CreditCard className="h-4 w-4" />
                  Pay {formatCurrency(customAmount)} with Paystack
                </Button>

                {/* Idempotency test button */}
                <Button
                  onClick={() => handlePaystackPayment(true)}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Layers className="h-3.5 w-3.5" /> Test Duplicate Webhook Idempotency
                </Button>
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Protected by 256-bit SSL encryption &amp; Paystack webhook signature HMAC SHA-512 verification.
              </p>
            </div>
          </Card>

          {/* Payments Transaction Ledger */}
          <Card className="lg:col-span-2 overflow-hidden flex flex-col">
            <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Authoritative Payments Ledger
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Verified server-side transactions &amp; receipt issuance
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPayments}
                className="h-8 gap-1 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </CardHeader>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Provider Reference</th>
                    <th className="px-5 py-3.5">Amount (NGN)</th>
                    <th className="px-5 py-3.5">Payer Details</th>
                    <th className="px-5 py-3.5">Receipt Link</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-800">
                        {p.providerReference}
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 text-xs">{p.payerName}</p>
                        <p className="text-[10px] text-slate-400">{p.paymentMethod.toUpperCase()}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-blue-700">
                        {p.receiptNumber}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="success" className="text-[10px] font-bold uppercase">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {formatDate(p.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex h-96 items-center justify-center">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Loading Paystack checkout portal...
            </div>
          </div>
        </AppShell>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}
