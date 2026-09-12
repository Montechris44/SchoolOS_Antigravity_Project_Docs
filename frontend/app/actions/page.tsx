"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listActions, updateActionStatus } from "@/lib/api/actions";
import { ApiError } from "@/lib/api/client";
import { SchoolAction, ActionStatus, ActionPriority } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatDate } from "@/lib/utils";
import {
  CheckSquare,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function ActionCenterPage() {
  const { school } = useAuth();
  const [actions, setActions] = useState<SchoolAction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Resolve Action Modal
  const [selectedActionToResolve, setSelectedActionToResolve] = useState<SchoolAction | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [actionErrorMsg, setActionErrorMsg] = useState("");

  const refreshActions = () => {
    if (!school) return;
    setLoadError(null);
    listActions()
      .then(setActions)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load actions."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const handleUpdateStatus = async (actionId: string, status: ActionStatus, outcome?: string) => {
    setActionErrorMsg("");
    try {
      await updateActionStatus(actionId, status, outcome);
      refreshActions();
      setSuccessBanner(`Action marked as ${status}!`);
      setTimeout(() => setSuccessBanner(""), 3000);
    } catch (err) {
      setActionErrorMsg(err instanceof ApiError ? err.message : "Failed to update action. Please try again.");
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActionToResolve) return;

    await handleUpdateStatus(selectedActionToResolve.id, "RESOLVED", resolutionOutcome);
    setSelectedActionToResolve(null);
    setResolutionOutcome("");
  };

  const filteredActions = actions.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchPriority = priorityFilter === "all" || a.priority === priorityFilter;
    return matchStatus && matchPriority;
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
        <ErrorState message={loadError} onRetry={refreshActions} />
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
              School Action Center
            </h1>
            <p className="text-sm text-slate-500">
              Transform detected risk signals into assigned, trackable operational interventions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              Total Interventions: <strong className="text-slate-900">{actions.length}</strong>
            </span>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successBanner}
          </div>
        )}

        {actionErrorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            {actionErrorMsg}
          </div>
        )}

        {/* Filters Bar */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status:
              </span>
              {["all", "OPEN", "IN_PROGRESS", "RESOLVED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    statusFilter === st
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Priority:
              </span>
              {["all", "P0", "P1", "P2"].map((pr) => (
                <button
                  key={pr}
                  onClick={() => setPriorityFilter(pr)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    priorityFilter === pr
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Action Cards Stream */}
        <div className="space-y-4">
          {filteredActions.map((act) => (
            <Card key={act.id} className="p-6 hover:shadow-xs transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={act.priority === "P0" ? "destructive" : "warning"}
                    className="font-mono text-xs px-2.5 py-0.5"
                  >
                    {act.priority}
                  </Badge>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{act.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>Assigned to: <strong className="text-slate-700">{act.assignedToName || "Staff"}</strong></span>
                      <span>•</span>
                      <span>Created {formatDate(act.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      act.status === "RESOLVED"
                        ? "success"
                        : act.status === "IN_PROGRESS"
                        ? "warning"
                        : "default"
                    }
                    className="text-xs font-bold uppercase"
                  >
                    {act.status}
                  </Badge>

                  {act.status !== "RESOLVED" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedActionToResolve(act);
                        setResolutionOutcome("");
                      }}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve Task
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(act.id, "OPEN")}
                      className="text-xs text-slate-500"
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Recommended Step & Intervention Details */}
              <div className="mt-4 space-y-2">
                <div className="rounded-xl bg-blue-50/50 p-3 border border-blue-100">
                  <span className="text-xs font-bold text-blue-900 block mb-0.5">
                    Recommended Operational Step:
                  </span>
                  <p className="text-xs text-blue-800 leading-relaxed">{act.recommendedStep}</p>
                </div>

                {act.notes && (
                  <p className="text-xs text-slate-500">
                    <strong>Internal Notes:</strong> {act.notes}
                  </p>
                )}

                {act.outcome && (
                  <div className="rounded-xl bg-emerald-50/50 p-3 border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900 block mb-0.5">
                      Verified Resolution Outcome:
                    </span>
                    <p className="text-emerald-800">{act.outcome}</p>
                    {act.resolvedAt && (
                      <p className="text-[10px] text-emerald-600 mt-1">
                        Resolved on {formatDate(act.resolvedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Modal: Resolve Action */}
        {selectedActionToResolve && (
          <Dialog
            isOpen={Boolean(selectedActionToResolve)}
            onClose={() => setSelectedActionToResolve(null)}
            title="Complete & Resolve Action"
            description="Document the operational outcome before closing this task."
          >
            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <p className="font-bold text-slate-800">{selectedActionToResolve.title}</p>
                <p className="text-slate-500 mt-0.5">{selectedActionToResolve.recommendedStep}</p>
              </div>

              <div className="w-full space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Resolution Notes &amp; Outcome
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Telephone conference completed with parent. Verified student recovered from malaria, returning tomorrow."
                  value={resolutionOutcome}
                  onChange={(e) => setResolutionOutcome(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setSelectedActionToResolve(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  Confirm &amp; Resolve
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
