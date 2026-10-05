"use client";

import React from "react";
import Link from "next/link";
import { CalendarCheck, GraduationCap, Wallet } from "lucide-react";
import { listParentChildren } from "@/lib/api/portal-daily";
import { useAuth } from "@/lib/auth/auth-context";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Avatar, Panel, useLoader } from "@/components/ui/portal";
import { formatCurrency } from "@/lib/utils";
import { Hero } from "./shared";

export function ParentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoader(listParentChildren, []);

  if (loading) return <LoadingSkeleton count={3} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load your children."} onRetry={reload} />;

  return (
    <div className="stagger space-y-6">
      <Hero variant="cozy" eyebrow="Parent portal" title={`Welcome, ${user?.fullName.split(" ")[0] ?? "parent"}`} subtitle="Results, attendance and fees for each of your children in one place." />

      {data.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No children linked yet" description="Ask the school office to link your account to your child's record." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.map((child) => (
            <Panel key={child.id} className="rounded-3xl border-brand/20 bg-gradient-to-b from-brand-soft/50 to-card">
              <div className="flex items-center gap-4">
                <Avatar name={`${child.firstName} ${child.lastName}`} src={child.photoUrl} size={56} />
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-lg font-bold text-slate-900">
                    {child.firstName} {child.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {child.className}
                    {child.armName ? ` ${child.armName}` : ""} · {child.admissionNumber}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-brand/10 bg-card p-3 shadow-2xs">
                  <p className="font-heading text-xl font-bold text-slate-900">{child.attendancePct ?? "—"}{child.attendancePct != null ? "%" : ""}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Attendance</p>
                </div>
                <div className="rounded-2xl border border-brand/10 bg-card p-3 shadow-2xs">
                  <p className="font-heading text-xl font-bold text-slate-900">{child.latestResult?.average != null ? Number(child.latestResult.average).toFixed(1) : "—"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Average</p>
                </div>
                <div className="rounded-2xl border border-brand/10 bg-card p-3 shadow-2xs">
                  <p className={`font-heading text-xl font-bold ${child.outstandingBalance > 0 ? "text-rose-600" : "text-green-700"}`}>{formatCurrency(child.outstandingBalance)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Balance</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
                <Link href={`/results/my?child=${child.id}`} className="inline-flex items-center gap-1.5 rounded-full border-2 border-brand/25 bg-card px-4 py-2 text-xs font-bold text-brand-strong hover:border-brand hover:bg-brand hover:text-white transition-all">
                  <GraduationCap className="h-4 w-4" /> Results
                </Link>
                <Link href={`/attendance/mine?child=${child.id}`} className="inline-flex items-center gap-1.5 rounded-full border-2 border-brand/25 bg-card px-4 py-2 text-xs font-bold text-brand-strong hover:border-brand hover:bg-brand hover:text-white transition-all">
                  <CalendarCheck className="h-4 w-4" /> Attendance
                </Link>
                <Link href="/finance" className="inline-flex items-center gap-1.5 rounded-full border-2 border-brand/25 bg-card px-4 py-2 text-xs font-bold text-brand-strong hover:border-brand hover:bg-brand hover:text-white transition-all">
                  <Wallet className="h-4 w-4" /> Fees
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
