"use client";

import React, { useState } from "react";
import { CheckCircle2, Eye, RotateCcw, Send } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, StatCard, Textarea, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { getAcademicStatus, getClassTeacherOverview, getClassTeacherSheet, returnSubjectToTeacher, submitClassToAdmin } from "@/lib/api/portal-academics";
import { gradeColor } from "@/lib/grades";
import { ClassTeacherBatch } from "@/types/portal";
import { formatDate } from "@/lib/utils";

export default function ClassTeacherPage() {
  const status = useLoader(getAcademicStatus, []);
  const [termId, setTermId] = useState("");
  const activeTermId = termId || status.data?.currentTerm?.id || "";
  const sessionId = status.data?.terms.find((t) => t.id === activeTermId)?.sessionId ?? "";

  const overview = useLoader(async () => (activeTermId ? getClassTeacherOverview(activeTermId, sessionId || undefined) : null), [activeTermId, sessionId]);

  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ batch: ClassTeacherBatch; sheet: Awaited<ReturnType<typeof getClassTeacherSheet>> } | null>(null);
  const [returning, setReturning] = useState<{ batch: ClassTeacherBatch; notes: string } | null>(null);

  const act = async (success: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: success });
      overview.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work." });
    } finally {
      setBusy(false);
    }
  };

  const openSheet = async (batch: ClassTeacherBatch) => {
    try {
      setViewing({ batch, sheet: await getClassTeacherSheet(batch.subjectId, activeTermId, sessionId || undefined) });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not load the subject." });
    }
  };

  const data = overview.data;
  const notClassTeacher = overview.error && /class teacher/i.test(overview.error);

  return (
    <AppShell allow={["owner", "admin", "teacher"]}>
      <PageHeader eyebrow="Results" title="Class Teacher" description="Review each subject your class teachers submitted, send corrections back, then submit the whole class to the administrator." />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <Panel className="mb-6">
        <div className="max-w-xs">
          <Select label="Term" value={activeTermId} onChange={(e) => setTermId(e.target.value)}>
            {status.data?.terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>)}
          </Select>
        </div>
      </Panel>

      {overview.loading ? <LoadingSkeleton count={4} /> : notClassTeacher ? (
        <EmptyState title="You are not a class teacher" description="Only the class teacher of a class or arm reviews and submits its results. Ask the administrator if this is a mistake." />
      ) : overview.error || !data ? <ErrorState message={overview.error ?? undefined} onRetry={overview.reload} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Subjects" value={data.stats.totalSubjects} icon={CheckCircle2} hint={data.homeroom.classLabel} />
            <StatCard label="Ready to submit" value={data.stats.readyForAdmin} icon={Send} tone="emerald" />
            <StatCard label="Needs attention" value={data.stats.needsAttention} icon={RotateCcw} tone="amber" />
            <StatCard label="With administrator" value={data.stats.pendingAdmin + data.stats.approved} icon={Eye} tone="violet" />
          </div>

          <Panel title="Subjects">
            <ul className="divide-y divide-slate-100">
              {data.batches.map((batch) => (
                <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold text-slate-900">{batch.subjectName}</p>
                    <p className="text-xs text-slate-500">{batch.teacherName ?? "—"} · {batch.studentCount} students</p>
                    {batch.reviewNotes && batch.status === "RETURNED_FOR_CORRECTION" && <p className="mt-1 text-xs text-amber-700">Note: {batch.reviewNotes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusTone(batch.status)}>{formatStatus(batch.status)}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openSheet(batch)}><Eye className="mr-1 h-3.5 w-3.5" /> Review</Button>
                    {batch.canReturn && <Button size="sm" variant="ghost" onClick={() => setReturning({ batch, notes: "" })}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Return</Button>}
                  </div>
                </li>
              ))}
              {data.notStarted.map((subject) => (
                <li key={subject.subjectId} className="flex items-center justify-between py-3">
                  <p className="font-bold text-slate-500">{subject.subjectName}</p>
                  <Badge variant="secondary">Not started</Badge>
                </li>
              ))}
              {data.batches.length + data.notStarted.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No subjects are assigned to your class yet.</li>}
            </ul>
          </Panel>

          <Panel title="Class summary" action={<span className="text-xs text-slate-400">Live preview — positions are final only when the administrator releases results</span>}>
            {data.classSummary.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No scores yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr><th className="pb-3">Pos.</th><th className="pb-3">Student</th><th className="pb-3 text-right">Total</th><th className="pb-3 text-right">Average</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.classSummary.map((row) => (
                      <tr key={row.studentId}>
                        <td className="py-2 font-bold text-brand">{row.positionLabel}</td>
                        <td className="py-2 font-semibold text-slate-800">{row.fullName}</td>
                        <td className="py-2 text-right">{row.grandTotal}</td>
                        <td className="py-2 text-right font-bold">{row.average}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {data.editAudits.length > 0 && (
            <Panel title="Edits after publishing">
              <ul className="space-y-2 text-sm text-slate-600">
                {data.editAudits.slice(0, 8).map((edit) => (
                  <li key={edit.id}>{formatDate(edit.createdAt)} — {edit.editorName} changed {edit.studentFirstName} {edit.studentLastName}&apos;s {edit.subjectName} score.</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Submit to the administrator">
            <Textarea label="Your remark on the class (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} />
            <div className="mt-4 flex items-center gap-3">
              <Button disabled={!data.stats.canSubmitToAdmin || busy} isLoading={busy} onClick={() => act("Class submitted to the administrator.", () => submitClassToAdmin(activeTermId, sessionId, remark || undefined))}>
                <Send className="mr-2 h-4 w-4" /> Submit class
              </Button>
              {!data.stats.canSubmitToAdmin && <span className="text-xs text-slate-500">Every subject must be published first, with none returned or missing.</span>}
            </div>
          </Panel>
        </div>
      )}

      <Dialog isOpen={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `${viewing.batch.subjectName} — scores` : ""} maxWidth="xl">
        {viewing && (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-2">Student</th>
                  {viewing.sheet.scheme?.components.map((c) => <th key={c.key} className="pb-2 text-center">{c.name}</th>)}
                  <th className="pb-2 text-center">Exam</th><th className="pb-2 text-center">Total</th><th className="pb-2 text-center">Grade</th><th className="pb-2 text-center">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewing.sheet.students.map((s) => (
                  <tr key={s.studentId}>
                    <td className="py-2 font-semibold">{s.lastName} {s.firstName}</td>
                    {viewing.sheet.scheme?.components.map((c) => <td key={c.key} className="py-2 text-center">{s.caComponents?.[c.key] ?? "—"}</td>)}
                    <td className="py-2 text-center">{s.scoresComplete ? s.examScore : "—"}</td>
                    <td className="py-2 text-center font-bold">{s.computedTotal ?? "—"}</td>
                    <td className={`py-2 text-center font-bold ${gradeColor(s.grade)}`}>{s.grade ?? "—"}</td>
                    <td className="py-2 text-center text-xs text-slate-500">{s.subjectPositionLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={returning !== null} onClose={() => setReturning(null)} title={returning ? `Return ${returning.batch.subjectName}` : ""} description="The subject teacher is notified and can correct and republish.">
        {returning && (
          <div className="space-y-4">
            <Textarea label="What needs correcting?" value={returning.notes} onChange={(e) => setReturning({ ...returning, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReturning(null)}>Cancel</Button>
              <Button disabled={returning.notes.trim().length < 3} onClick={() => { const r = returning; setReturning(null); void act("Returned to the subject teacher.", () => returnSubjectToTeacher(r.batch.subjectId, activeTermId, r.notes)); }}>Return subject</Button>
            </div>
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
