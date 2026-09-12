"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listSignals, getSchoolHealth } from "@/lib/api/intelligence";
import { createAction } from "@/lib/api/actions";
import { ApiError } from "@/lib/api/client";
import { IntelligenceSignal, SchoolHealthScore } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatDate } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Eye,
  PlusCircle,
  TrendingDown,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";

function recommendedStepForSignal(signal: IntelligenceSignal): string {
  if (signal.type === "LOW_ATTENDANCE") {
    return `Telephone student's guardian (${signal.evidence.guardianName || "Parent"}) to verify reason for repeated absence.`;
  }
  if (signal.type === "OVERDUE_FEES") {
    return `Dispatch a payment reminder for ${signal.metricValue} to the guardian.`;
  }
  return "Investigate and report to school principal.";
}

export default function IntelligencePage() {
  const { school } = useAuth();
  const [signals, setSignals] = useState<IntelligenceSignal[]>([]);
  const [healthScore, setHealthScore] = useState<SchoolHealthScore | null>(null);
  const [selectedSignalForEvidence, setSelectedSignalForEvidence] = useState<IntelligenceSignal | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [actionErrorMsg, setActionErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshSignals = () => {
    if (!school) return;
    setLoadError(null);
    Promise.all([listSignals(), getSchoolHealth()])
      .then(([sigs, health]) => {
        setSignals(sigs);
        setHealthScore(health);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load intelligence data."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const handleConvertToAction = async (signal: IntelligenceSignal) => {
    setActionErrorMsg("");
    try {
      await createAction({
        title: `Action: ${signal.title}`,
        recommendedStep: recommendedStepForSignal(signal),
        priority: signal.severity === "critical" ? "P0" : signal.severity === "high" ? "P1" : "P2",
        notes: `Generated from signal ${signal.id}. Value: ${signal.metricValue}`,
      });
      setActionSuccessMsg(`Created Action Center task for signal '${signal.title}'!`);
      setTimeout(() => setActionSuccessMsg(""), 3500);
    } catch (err) {
      setActionErrorMsg(err instanceof ApiError ? err.message : "Failed to create action. Please try again.");
    }
  };

  const filteredSignals = signals.filter((s) => {
    if (severityFilter === "all") return true;
    return s.severity === severityFilter;
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
        <ErrorState message={loadError} onRetry={refreshSignals} />
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
              Intelligence Signals &amp; Risk Observatory
            </h1>
            <p className="text-sm text-slate-500">
              Deterministic operational signals derived from live academic, financial, and attendance records.
            </p>
          </div>
          <Link href="/actions">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="h-4 w-4" /> Open Action Center
            </Button>
          </Link>
        </div>

        {/* Success Banner */}
        {actionSuccessMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {actionSuccessMsg}
          </div>
        )}

        {actionErrorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            {actionErrorMsg}
          </div>
        )}

        {/* Health Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-blue-200 bg-blue-50/20">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Overall School Health
            </span>
            <p className="text-3xl font-black text-slate-900 mt-1">
              {healthScore?.overallScore || 82}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Weighted composite across all engines</p>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Financial Health
            </span>
            <p className="text-3xl font-black text-emerald-700 mt-1">
              {healthScore?.financialHealth || 85}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Tuition recovery &amp; collection speed</p>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Attendance Stability
            </span>
            <p className="text-3xl font-black text-blue-700 mt-1">
              {healthScore?.attendanceHealth || 88}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Daily roll-call consistency</p>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Faculty Compliance
            </span>
            <p className="text-3xl font-black text-purple-700 mt-1">
              {healthScore?.submissionCompliance || 85}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Timely assessment submissions</p>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Filter by Signal Severity:
          </span>
          <div className="flex items-center gap-1.5">
            {["all", "critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`rounded-lg px-3 py-1 text-xs font-bold uppercase transition-colors ${
                  severityFilter === sev
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Signals List */}
        <div className="space-y-4">
          {filteredSignals.map((sig) => (
            <Card key={sig.id} className="p-6 hover:shadow-xs transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2.5 ${
                      sig.severity === "critical"
                        ? "bg-rose-100 text-rose-700"
                        : sig.severity === "high"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900">{sig.title}</h3>
                      <Badge
                        variant={
                          sig.severity === "critical"
                            ? "destructive"
                            : sig.severity === "high"
                            ? "warning"
                            : "default"
                        }
                        className="uppercase text-[10px] font-bold"
                      >
                        {sig.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Type: {sig.type} • Detected {formatDate(sig.detectedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedSignalForEvidence(sig)}
                    className="gap-1.5 text-xs text-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" /> Inspect Evidence
                  </Button>
                  {!sig.actionCreated ? (
                    <Button
                      size="sm"
                      onClick={() => handleConvertToAction(sig)}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Create Action Task
                    </Button>
                  ) : (
                    <Badge variant="success" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Action Active
                    </Badge>
                  )}
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-700">{sig.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400">Trigger Metric: </span>
                  <strong className="text-slate-800 font-mono">{sig.metricValue}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Rule Threshold: </span>
                  <span className="text-slate-600 font-medium">{sig.threshold}</span>
                </div>
                {sig.studentName && (
                  <div>
                    <span className="text-slate-400">Target Scholar: </span>
                    <strong className="text-blue-700">{sig.studentName}</strong>
                  </div>
                )}
                {sig.className && (
                  <div>
                    <span className="text-slate-400">Class: </span>
                    <strong className="text-slate-700">{sig.className}</strong>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Modal: Evidence Inspector */}
        {selectedSignalForEvidence && (
          <Dialog
            isOpen={Boolean(selectedSignalForEvidence)}
            onClose={() => setSelectedSignalForEvidence(null)}
            title="Authoritative Signal Evidence View"
            description="Inspect the ground-truth data points that triggered this deterministic alert."
          >
            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider">
                    {selectedSignalForEvidence.title}
                  </span>
                  <Badge variant="destructive" className="uppercase font-mono">
                    {selectedSignalForEvidence.severity}
                  </Badge>
                </div>
                <p className="text-slate-600">{selectedSignalForEvidence.description}</p>
              </div>

              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Ground Truth Telemetry &amp; Evidence Fields
                </h4>
                <div className="rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs overflow-x-auto text-slate-800">
                  <pre>{JSON.stringify(selectedSignalForEvidence.evidence, null, 2)}</pre>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button size="sm" onClick={() => setSelectedSignalForEvidence(null)}>
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
