"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/db/mock-db";
import { intelligenceEngine } from "@/modules/intelligence/engine";
import { SchoolHealthScore, IntelligenceSignal, SchoolAction } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function DashboardPage() {
  const { user, school, role } = useAuth();
  const [healthScore, setHealthScore] = useState<SchoolHealthScore | null>(null);
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [actions, setActions] = useState<SchoolAction[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [totalBilled, setTotalBilled] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);

  const securityCtx = {
    userId: user?.id || "usr_owner_01",
    userSchoolId: school?.id || "sch_emerald_crest_001",
    role,
  };

  useEffect(() => {
    if (!school) return;
    const health = intelligenceEngine.calculateSchoolHealth(securityCtx);
    const sigs = intelligenceEngine.evaluateSignals(securityCtx);
    const acts = db.getActions(securityCtx);
    const stds = db.getStudents(securityCtx);
    const invs = db.getInvoices(securityCtx);

    setHealthScore(health);
    setSignals(sigs);
    setActions(acts);
    setStudentCount(stds.length);
    setTotalBilled(invs.reduce((acc, i) => acc + i.totalAmount, 0));
    setTotalCollected(invs.reduce((acc, i) => acc + i.amountPaid, 0));
  }, [school, role]);

  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const pendingActions = actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome & School Status Banner */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-linear-to-r from-blue-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                School Executive Console
              </span>
              <span className="bg-blue-800/80 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Active Session 2026/2027
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Welcome back, {user?.fullName}
            </h1>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              SchoolOS is monitoring {school?.name} across academics, fee collections, student welfare, and staff compliance.
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-blue-800 pt-3 md:pt-0 md:pl-6">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase text-blue-300">School Health Score</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-white">{healthScore?.overallScore || 82}</span>
                <span className="text-xs text-blue-300 font-semibold">/ 100</span>
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold mt-0.5">
                ● Strong Operational Stability
              </span>
            </div>
          </div>
        </div>

        {/* 4 Core Authoritative KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Finance KPI */}
          <Card className="p-5 hover:shadow-md transition-shadow border-l-4 border-l-blue-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fee Collections
              </span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {formatCurrency(totalCollected)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{collectionRate}% Collected</span>
              <span className="text-rose-600 font-semibold">
                {formatCurrency(totalBilled - totalCollected)} due
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${collectionRate}%` }} />
            </div>
          </Card>

          {/* Attendance KPI */}
          <Card className="p-5 hover:shadow-md transition-shadow border-l-4 border-l-emerald-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Daily Attendance
              </span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">88.5%</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="text-emerald-700 font-semibold">95% JSS 1 Gold</span>
              <span className="text-rose-600 font-medium">1 risk detected</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `88%` }} />
            </div>
          </Card>

          {/* Academics KPI */}
          <Card className="p-5 hover:shadow-md transition-shadow border-l-4 border-l-purple-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Academic Pass Rate
              </span>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">84.2%</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>WAEC Scale: Credit+</span>
              <span className="font-semibold text-purple-700">Top: 88%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `84%` }} />
            </div>
          </Card>

          {/* Enrollment KPI */}
          <Card className="p-5 hover:shadow-md transition-shadow border-l-4 border-l-amber-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Enrollment
              </span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{studentCount} Scholars</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Across 4 Active Classes</span>
              <span className="text-amber-700 font-semibold">100% Assigned</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `92%` }} />
            </div>
          </Card>
        </div>

        {/* Intelligence Signals & Action Center Priority Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Intelligence Signal Stream */}
          <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-base text-slate-900">
                    Active Operational Signals
                  </h3>
                </div>
                <Link href="/intelligence">
                  <span className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                    View Observatory <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>

              <div className="space-y-3">
                {signals.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-lg p-2 mt-0.5 ${
                          sig.severity === "critical"
                            ? "bg-rose-100 text-rose-700"
                            : sig.severity === "high"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
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
                        <p className="text-xs text-slate-500 mt-0.5">{sig.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200">
                        {sig.metricValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Deterministic signals evaluated continuously against live school records.</span>
            </div>
          </Card>

          {/* Action Center Priority Summary */}
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-base text-slate-900">
                    Action Center
                  </h3>
                </div>
                <Badge variant="default">{pendingActions.length} Pending</Badge>
              </div>

              <div className="space-y-3">
                {actions.map((act) => (
                  <div key={act.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 line-clamp-1">{act.title}</span>
                      <Badge variant={act.priority === "P0" ? "destructive" : "warning"} className="text-[10px]">
                        {act.priority}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{act.recommendedStep}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                      <span>Assigned: {act.assignedToName}</span>
                      <Badge variant={act.status === "RESOLVED" ? "success" : "secondary"}>
                        {act.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link href="/actions">
                <Button className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                  Manage Action Center <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* AI Assistant Quick Prompt Banner */}
        <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-50 to-indigo-50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-purple-600 p-3 text-white shadow-md shadow-purple-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                SchoolOS AI Intelligence Gateway
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Ask natural language operational questions grounded in authoritative school data.
              </p>
            </div>
          </div>
          <Link href="/ai">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-sm text-xs">
              <Sparkles className="h-4 w-4" /> Ask: &ldquo;How is my school doing?&rdquo;
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
