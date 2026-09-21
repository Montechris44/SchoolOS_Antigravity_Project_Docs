"use client";

import React from "react";
import { Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { PageHeader, Panel, StatCard, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { getStudentFees } from "@/lib/api/portal-daily";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function MyFeesPage() {
  const fees = useLoader(getStudentFees, []);
  const total = fees.data?.reduce((s, i) => s + i.totalAmount, 0) ?? 0;
  const paid = fees.data?.reduce((s, i) => s + i.amountPaid, 0) ?? 0;

  return (
    <AppShell allow={["student"]}>
      <PageHeader eyebrow="My school" title="Fees" description="Your invoices and payments. Ask your parent or guardian to settle any balance with the school bursar." />
      {fees.loading ? <LoadingSkeleton count={3} /> : fees.error || !fees.data ? <ErrorState message={fees.error ?? undefined} onRetry={fees.reload} /> : fees.data.length === 0 ? (
        <EmptyState icon={Wallet} title="No invoices" description="You have no fee invoices at the moment." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Billed" value={formatCurrency(total)} icon={Wallet} />
            <StatCard label="Paid" value={formatCurrency(paid)} icon={Wallet} tone="emerald" />
            <StatCard label="Outstanding" value={formatCurrency(total - paid)} icon={Wallet} tone={total - paid > 0 ? "rose" : "emerald"} />
          </div>
          {fees.data.map((invoice) => (
            <Panel key={invoice.id} title={`${invoice.termName} · ${invoice.invoiceNumber}`} action={<Badge variant={statusTone(invoice.status)}>{formatStatus(invoice.status)}</Badge>}>
              <ul className="divide-y divide-slate-100 text-sm">
                {invoice.items.map((item, i) => <li key={i} className="flex justify-between py-2"><span>{item.description}</span><span className="font-semibold">{formatCurrency(item.amount)}</span></li>)}
              </ul>
              <p className="mt-3 text-xs text-slate-400">Due {formatDate(invoice.dueDate)} · Balance {formatCurrency(invoice.balanceDue)}</p>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
