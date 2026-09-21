"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { PageHeader, Panel, StatCard, useLoader } from "@/components/ui/portal";
import { ReportCard } from "@/components/portal/report-card";
import { useAuth } from "@/lib/auth/auth-context";
import { getMyResults, getPublishedResults, getReportCard } from "@/lib/api/portal-academics";
import { listParentChildren } from "@/lib/api/portal-daily";
import { gradeColor } from "@/lib/grades";
import { Award, BookOpen, Percent } from "lucide-react";

function ResultsView() {
  const { role } = useAuth();
  const search = useSearchParams();
  const isParent = role === "parent";

  const children = useLoader(async () => (isParent ? listParentChildren() : []), [isParent]);
  const [childId, setChildId] = useState(search.get("child") ?? "");
  useEffect(() => {
    if (isParent && !childId && children.data?.[0]) setChildId(children.data[0].id);
  }, [isParent, childId, children.data]);

  const results = useLoader(async () => {
    if (isParent) return childId ? getPublishedResults(childId) : [];
    return getMyResults();
  }, [isParent, childId]);

  const [termId, setTermId] = useState("");
  const list = results.data ?? [];
  const active = list.find((r) => r.termId === termId) ?? list[0] ?? null;

  const [showCard, setShowCard] = useState(false);
  const card = useLoader(async () => (showCard && active ? getReportCard({ studentId: isParent ? childId : undefined, termId: active.termId }) : null), [showCard, active?.termId, childId]);

  return (
    <>
      <PageHeader eyebrow="Academics" title="Results & Report Card" description="Published results appear here as soon as the school releases them." />

      {isParent && (
        <Panel className="mb-6">
          <div className="max-w-xs">
            <Select label="Child" value={childId} onChange={(e) => { setChildId(e.target.value); setTermId(""); setShowCard(false); }}>
              {children.data?.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </Select>
          </div>
        </Panel>
      )}

      {results.loading ? <LoadingSkeleton count={4} /> : results.error ? <ErrorState message={results.error} onRetry={results.reload} /> : !active ? (
        <EmptyState icon={GraduationCap} title="No published results yet" description="Results will show here once the school administrator releases them for your class." />
      ) : (
        <div className="space-y-6">
          <Panel className="no-print">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="w-64">
                <Select label="Term" value={active.termId} onChange={(e) => { setTermId(e.target.value); setShowCard(false); }}>
                  {list.map((r) => <option key={r.id} value={r.termId}>{r.termName} — {r.sessionName}</option>)}
                </Select>
              </div>
              <Button variant={showCard ? "outline" : "primary"} onClick={() => setShowCard((v) => !v)}><FileText className="mr-2 h-4 w-4" /> {showCard ? "Hide report card" : "View report card"}</Button>
            </div>
          </Panel>

          {showCard ? (
            card.loading ? <LoadingSkeleton count={4} /> : card.error || !card.data ? <ErrorState message={card.error ?? undefined} onRetry={card.reload} /> : <ReportCard card={card.data} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Position" value={`${active.positionSuffix ?? active.position ?? "—"}`} icon={Award} tone="amber" hint={`of ${active.classSize ?? "—"} students`} />
                <StatCard label="Average" value={active.averageScore != null ? Number(active.averageScore).toFixed(1) : "—"} icon={Percent} />
                <StatCard label="Total score" value={active.totalScore ?? "—"} icon={BookOpen} tone="emerald" />
                <StatCard label="Subjects passed" value={`${active.passedSubjects}/${active.totalSubjects}`} icon={GraduationCap} tone="violet" />
              </div>

              <Panel title={`${active.termName} · ${active.sessionName}`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr><th className="pb-3">Subject</th><th className="pb-3 text-center">Exam</th><th className="pb-3 text-center">Total</th><th className="pb-3 text-center">Grade</th><th className="pb-3">Remark</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {active.subjects.map((s) => (
                        <tr key={s.subjectId}>
                          <td className="py-2.5 font-semibold text-slate-800">{s.subjectName}</td>
                          <td className="py-2.5 text-center">{s.examScore ?? "—"}</td>
                          <td className="py-2.5 text-center font-bold">{s.totalScore ?? "—"}</td>
                          <td className={`py-2.5 text-center font-bold ${gradeColor(s.grade)}`}>{s.grade ?? "—"}</td>
                          <td className="py-2.5 text-slate-500">{s.subjectRemark || s.gradeRemark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(active.teacherRemark || active.principalRemark) && (
                  <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    {active.teacherRemark && <p><strong>Class teacher:</strong> {active.teacherRemark}</p>}
                    {active.principalRemark && <p><strong>Principal:</strong> {active.principalRemark}</p>}
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function MyResultsPage() {
  return (
    <AppShell allow={["student", "parent"]}>
      <Suspense fallback={<LoadingSkeleton count={3} />}>
        <ResultsView />
      </Suspense>
    </AppShell>
  );
}
