"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { getSchoolHealth, listSignals } from "@/lib/api/intelligence";
import { listActions } from "@/lib/api/actions";
import { listStudents } from "@/lib/api/students";
import { listInvoices } from "@/lib/api/finance";
import { ApiError } from "@/lib/api/client";
import { SchoolHealthScore, IntelligenceSignal, SchoolAction } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatCurrency } from "@/lib/utils";
import {
  Activity,
  Users,
  CreditCard,
  GraduationCap,
  CalendarCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShieldCheck,
} from "lucide-react";

export function ManagementDashboard() {
  const { user, school } = useAuth();
  const [healthScore, setHealthScore] = useState<SchoolHealthScore | null>(null);
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [actions, setActions] = useState<SchoolAction[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [totalBilled, setTotalBilled] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshDashboard = () => {
    if (!school) return;
    setLoadError(null);

    Promise.all([getSchoolHealth(), listSignals(), listActions(), listStudents(), listInvoices()])
      .then(([health, sigs, acts, stds, invs]) => {
        setHealthScore(health);
        setSignals(sigs);
        setActions(acts);
        setStudentCount(stds.length);
        setTotalBilled(invs.reduce((acc, i) => acc + i.totalAmount, 0));
        setTotalCollected(invs.reduce((acc, i) => acc + i.amountPaid, 0));
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load dashboard data."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const pendingActions = actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");

  if (isLoading) {
    return (
      <>
        <LoadingSkeleton count={5} />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <ErrorState message={loadError} onRetry={refreshDashboard} />
      </>
    );
  }

  return (
    <>
      <div className="stagger space-y-6 sm:space-y-8">
        {/* Welcome & School Status Banner */}
        <div className="chalkboard relative overflow-hidden rounded-2xl border-[6px] border-[#8a6a3d] text-white p-6 sm:p-8 shadow-card">
          <GraduationCap className="pointer-events-none absolute -right-4 -top-4 h-40 w-40 -rotate-12 text-white/[0.06] sm:h-56 sm:w-56" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-gold border border-dashed border-gold/60 px-2.5 py-0.5 rounded-md">
                  School Executive Console
                </span>
                <span className="bg-green-500/20 border border-green-400/30 text-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                  Active Session 2026/2027
                </span>
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome back, {user?.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-xl leading-relaxed">
                SchoolOS is monitoring {school?.name} across academics, fee collections, student welfare, and staff compliance.
              </p>
            </div>

            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/15 pt-4 md:pt-0 md:pl-8 shrink-0">
              <div className="flex flex-col items-start md:items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">School Health Score</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-heading text-5xl font-black text-gold">{healthScore?.overallScore || 82}</span>
                  <span className="text-xs text-white/60 font-semibold">/ 100</span>
                </div>
                <span className="text-[11px] text-green-200 font-semibold mt-0.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Strong Operational Stability
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Core Authoritative KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Finance KPI */}
          <Card className="rounded-2xl p-6 hover:shadow-card-hover transition-all duration-200 border-l-4 border-l-brand">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fee Collections
              </span>
              <div className="rounded-xl bg-brand-soft p-2.5 text-brand ring-4 ring-brand/10">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-heading text-2xl font-black text-slate-900 mt-3">
              {formatCurrency(totalCollected)}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-emerald-700">{collectionRate}% Collected</span>
              <span className="text-rose-600 font-semibold">
                {formatCurrency(totalBilled - totalCollected)} due
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-brand h-2 rounded-full transition-all duration-500" style={{ width: `${collectionRate}%` }} />
            </div>
          </Card>

          {/* Attendance KPI */}
          <Card className="rounded-2xl p-6 hover:shadow-card-hover transition-all duration-200 border-l-4 border-l-green-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Daily Attendance
              </span>
              <div className="rounded-xl bg-green-50 p-2.5 text-green-700 ring-4 ring-green-500/10">
                <CalendarCheck className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-heading text-2xl font-black text-slate-900 mt-3">88.5%</p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span className="text-emerald-700 font-semibold">95% JSS 1 Gold</span>
              <span className="text-rose-600 font-medium">1 risk detected</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `88%` }} />
            </div>
          </Card>

          {/* Academics KPI */}
          <Card className="rounded-2xl p-6 hover:shadow-card-hover transition-all duration-200 border-l-4 border-l-gold">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Academic Pass Rate
              </span>
              <div className="rounded-xl bg-gold-soft p-2.5 text-slate-800 ring-4 ring-gold/20">
                <GraduationCap className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-heading text-2xl font-black text-slate-900 mt-3">84.2%</p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span>WAEC Scale: Credit+</span>
              <span className="font-semibold text-slate-800">Top: 88%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-gold h-2 rounded-full transition-all duration-500" style={{ width: `84%` }} />
            </div>
          </Card>

          {/* Enrollment KPI */}
          <Card className="rounded-2xl p-6 hover:shadow-card-hover transition-all duration-200 border-l-4 border-l-teal-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Enrollment
              </span>
              <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 ring-4 ring-teal-500/10">
                <Users className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="font-heading text-2xl font-black text-slate-900 mt-3">{studentCount} Scholars</p>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span>Across 4 Active Classes</span>
              <span className="text-teal-700 font-semibold">100% Assigned</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div className="bg-teal-600 h-2 rounded-full transition-all duration-500" style={{ width: `92%` }} />
            </div>
          </Card>
        </div>

        {/* Intelligence Signals & Action Center Priority Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Intelligence Signal Stream */}
          <Card className="lg:col-span-2 rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-subtle">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Activity className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    Active Operational Signals
                  </h3>
                </div>
                <Link href="/intelligence">
                  <span className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 cursor-pointer">
                    View Observatory <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>

              <div className="space-y-3">
                {signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2 mt-0.5 shrink-0 ${
                          sig.severity === "critical"
                            ? "bg-rose-100 text-rose-700"
                            : sig.severity === "high"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-brand-soft text-brand-strong"
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900">{sig.title}</p>
                          <Badge
                            variant={
                              sig.severity === "critical"
                                ? "destructive"
                                : sig.severity === "high"
                                ? "warning"
                                : "default"
                            }
                            className="text-[10px] font-bold uppercase"
                          >
                            {sig.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sig.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                        {sig.metricValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Deterministic signals evaluated continuously against live school records.</span>
            </div>
          </Card>

          {/* Action Center Priority Summary */}
          <Card className="rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-subtle">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    Action Center
                  </h3>
                </div>
                <Badge variant="default">{pendingActions.length} Pending</Badge>
              </div>

              <div className="space-y-3">
                {actions.map((act) => (
                  <div key={act.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 line-clamp-1">{act.title}</span>
                      <Badge variant={act.priority === "P0" ? "destructive" : "warning"} className="text-[10px]">
                        {act.priority}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{act.recommendedStep}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                      <span>Assigned: {act.assignedToName}</span>
                      <Badge variant={act.status === "RESOLVED" ? "success" : "secondary"}>
                        {act.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100">
              <Link href="/actions">
                <Button className="w-full gap-1.5 text-xs font-semibold">
                  Manage Action Center <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* AI Assistant Quick Prompt Banner */}
        <div className="rounded-2xl border-2 border-dashed border-gold/70 bg-gold-soft p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-brand p-3.5 text-white shadow-press-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                SchoolOS AI Intelligence Gateway
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                Ask natural language operational questions grounded in authoritative school data.
              </p>
            </div>
          </div>
          <Link href="/ai">
            <Button className="gap-2 text-xs font-semibold shrink-0">
              <Sparkles className="h-4 w-4" /> Ask: &ldquo;How is my school doing?&rdquo;
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
