"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listInvoices, listFeeStructures, createInvoice } from "@/lib/api/finance";
import { listReceipts } from "@/lib/api/payments";
import { listStudents } from "@/lib/api/students";
import { ApiError } from "@/lib/api/client";
import { Invoice, FeeStructure, Receipt, Student } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  Receipt as ReceiptIcon,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Printer,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function FinancePage() {
  const { school } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoices" | "feeStructures" | "receipts">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create Invoice Modal
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(185000);
  const [invoiceDescription, setInvoiceDescription] = useState("First Term Tuition & General School Fee");
  const [invoiceDueDate, setInvoiceDueDate] = useState("2026-09-30");
  const [invoiceErrorMsg, setInvoiceErrorMsg] = useState("");

  // View Receipt Modal
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);

  const refreshData = () => {
    if (!school) return;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([listInvoices(), listFeeStructures(), listReceipts(), listStudents()])
      .then(([inv, fs, rcpts, stds]) => {
        setInvoices(inv);
        setFeeStructures(fs);
        setReceipts(rcpts);
        setStudents(stds);
        if (stds.length > 0 && !selectedStudentId) {
          setSelectedStudentId(stds[0].id);
        }
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load finance data."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;
    setInvoiceErrorMsg("");

    try {
      await createInvoice({
        studentId: student.id,
        description: invoiceDescription,
        amount: Number(invoiceAmount),
        dueDate: invoiceDueDate,
      });
      refreshData();
      setIsCreateInvoiceModalOpen(false);
    } catch (err) {
      setInvoiceErrorMsg(err instanceof ApiError ? err.message : "Failed to issue invoice. Please try again.");
    }
  };

  // Finance Aggregates
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + inv.amountPaid, 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === "all") return true;
    return inv.status.toLowerCase() === statusFilter.toLowerCase();
  });

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
        <ErrorState message={loadError} onRetry={refreshData} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Finance & Fee Collections
            </h1>
            <p className="text-sm text-slate-500">
              Authoritative billings, Paystack collection tracking, invoice issuance, and official receipts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/payments">
              <Button variant="outline" size="sm" className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50">
                <CreditCard className="h-4 w-4" /> Paystack Gateway Simulation
              </Button>
            </Link>
            <Button
              onClick={() => setIsCreateInvoiceModalOpen(true)}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Issue Student Invoice
            </Button>
          </div>
        </div>

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Term Billed
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(totalBilled)}
            </p>
            <div className="mt-2 flex items-center text-xs text-slate-500 gap-1">
              <span>{invoices.length} invoices issued</span>
            </div>
          </Card>

          <Card className="p-5 border-emerald-200 bg-emerald-50/30">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Payments Verified
            </span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {formatCurrency(totalCollected)}
            </p>
            <div className="mt-2 flex items-center text-xs text-emerald-600 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{receipts.length} verified transactions</span>
            </div>
          </Card>

          <Card className="p-5 border-rose-200 bg-rose-50/30">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              Total Overdue &amp; Unpaid
            </span>
            <p className="text-2xl font-bold text-rose-700 mt-1">
              {formatCurrency(totalOutstanding)}
            </p>
            <div className="mt-2 flex items-center text-xs text-rose-600 gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Risk signal active</span>
            </div>
          </Card>

          <Card className="p-5 border-blue-200 bg-blue-50/30">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Collection Rate
            </span>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {collectionRate}%
            </p>
            <div className="w-full bg-blue-200 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "invoices"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="h-4 w-4" /> Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab("feeStructures")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "feeStructures"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="h-4 w-4" /> Configured Fee Structures
          </button>
          <button
            onClick={() => setActiveTab("receipts")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "receipts"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ReceiptIcon className="h-4 w-4" /> Receipts Archive ({receipts.length})
          </button>
        </div>

        {/* TAB 1: INVOICES */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Filter by Payment Status:
              </span>
              <div className="flex items-center gap-1.5">
                {["all", "PAID", "PARTIAL", "OVERDUE", "ISSUED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      statusFilter === st
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Invoice ID</th>
                      <th className="px-6 py-3.5">Scholar</th>
                      <th className="px-6 py-3.5">Billed Amount</th>
                      <th className="px-6 py-3.5">Paid</th>
                      <th className="px-6 py-3.5">Balance Due</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-blue-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{inv.studentName}</p>
                          <p className="text-xs text-slate-400">{inv.guardianName}</p>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-700">
                          {formatCurrency(inv.amountPaid)}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {formatCurrency(inv.balanceDue)}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              inv.status === "PAID"
                                ? "success"
                                : inv.status === "OVERDUE"
                                ? "destructive"
                                : inv.status === "PARTIAL"
                                ? "warning"
                                : "default"
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {inv.balanceDue > 0 ? (
                            <Link href={`/payments?invoiceId=${inv.id}&amount=${inv.balanceDue}`}>
                              <Button size="sm" className="h-8 gap-1 text-xs bg-blue-600 hover:bg-blue-700">
                                Pay with Paystack <ArrowUpRight className="h-3 w-3" />
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700">Fully Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: FEE STRUCTURES */}
        {activeTab === "feeStructures" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feeStructures.map((fs) => (
              <Card key={fs.id} className="p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{fs.title}</h3>
                    <p className="text-xs text-slate-500">{fs.termName} • Grade: {fs.classGradeLevel}</p>
                  </div>
                  <Badge variant="secondary">{formatCurrency(fs.totalAmount)}</Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {fs.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between py-1 text-slate-600 border-b border-slate-50">
                      <span>{it.name}</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 3: RECEIPTS ARCHIVE */}
        {activeTab === "receipts" && (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Receipt No.</th>
                      <th className="px-6 py-3.5">Student Scholar</th>
                      <th className="px-6 py-3.5">Amount Settled</th>
                      <th className="px-6 py-3.5">Remaining Balance</th>
                      <th className="px-6 py-3.5">Payment Method</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5 text-right">Receipt Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-blue-700">
                          {r.receiptNumber}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{r.studentName}</td>
                        <td className="px-6 py-4 font-bold text-emerald-700">
                          {formatCurrency(r.amountPaid)}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">
                          {formatCurrency(r.remainingBalance)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default" className="uppercase font-mono text-[10px]">
                            {r.paymentMethod}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatDate(r.paymentDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewReceipt(r)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Printer className="h-3.5 w-3.5" /> View Voucher
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Modal: Create Invoice */}
        <Dialog
          isOpen={isCreateInvoiceModalOpen}
          onClose={() => setIsCreateInvoiceModalOpen(false)}
          title="Issue New Student Billing Invoice"
          description="Assign school fees to student account with clear payment due date."
        >
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            {invoiceErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {invoiceErrorMsg}
              </div>
            )}
            <div className="w-full space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Target Enrolled Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.admissionNumber})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Fee Description / Purpose"
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Invoice Amount (NGN)"
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                required
              />
              <Input
                label="Payment Due Date"
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsCreateInvoiceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Issue Official Invoice</Button>
            </div>
          </form>
        </Dialog>

        {/* Modal: View Receipt Voucher */}
        {viewReceipt && (
          <Dialog
            isOpen={Boolean(viewReceipt)}
            onClose={() => setViewReceipt(null)}
            title="Official School Payment Voucher"
            description="Authoritative payment verification certificate"
          >
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 space-y-4 text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <p className="font-bold text-sm uppercase text-slate-900">{school?.name}</p>
                <p className="text-slate-500">{school?.address}, {school?.city}</p>
                <Badge variant="success" className="mt-2">Payment Verified &amp; Confirmed</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Voucher #:</span>
                  <span className="font-mono font-bold text-blue-700">{viewReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scholar Beneficiary:</span>
                  <span className="font-bold text-slate-800">{viewReceipt.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid:</span>
                  <span className="font-bold text-emerald-700 text-sm">{formatCurrency(viewReceipt.amountPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Balance:</span>
                  <span className="font-bold text-slate-700">{formatCurrency(viewReceipt.remainingBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Gateway:</span>
                  <span className="uppercase font-semibold text-slate-700">{viewReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <span className="text-slate-700">{formatDate(viewReceipt.paymentDate)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1">
                  <Printer className="h-3.5 w-3.5" /> Print Receipt
                </Button>
                <Button size="sm" onClick={() => setViewReceipt(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
