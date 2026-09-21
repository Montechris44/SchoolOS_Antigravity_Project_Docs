"use client";

import React, { useState } from "react";
import { CheckCircle2, Eye, PartyPopper, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, StatCard, Textarea, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { approveBatch, getAcademicStatus, getApprovalMetrics, getApprovalQueue, getBatchDetail, listPortalClasses, releaseClass, returnBatch } from "@/lib/api/portal-academics";
import { gradeColor } from "@/lib/grades";
import { BatchDetail, QueueItem } from "@/types/portal";
import { formatDate } from "@/lib/utils";

const FILTERS = [
  { value: "pending", label: "Pending review" },
  { value: "returned", label: "Returned" },
  { value: "approved", label: "Approved" },
  { value: "released", label: "Released" },
  { value: "all", label: "Everything" },
];

export default function ApprovalsPage() {
  const status = useLoader(getAcademicStatus, []);
  const classes = useLoader(listPortalClasses, []);
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [filter, setFilter] = useState("pending");
  const activeTermId = termId || status.data?.currentTerm?.id || "";

  const queue = useLoader(() => (activeTermId ? getApprovalQueue({ termId: activeTermId, classId: classId || undefined, status: filter }) : Promise.resolve([] as QueueItem[])), [activeTermId, classId, filter]);
  const metrics = useLoader(() => (activeTermId ? getApprovalMetrics({ termId: activeTermId }) : Promise.resolve(null)), [activeTermId, queue.data]);

  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [returning, setReturning] = useState<{ item: QueueItem; notes: string } | null>(null);
  const [releasing, setReleasing] = useState<{ item: QueueItem; remark: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (success: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: success });
      setDetail(null);
      queue.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work." });
    } finally {
      setBusy(false);
    }
  };

  const open = async (item: QueueItem) => {
    try {
      setDetail(await getBatchDetail(item.id));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not open this submission." });
    }
  };

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader eyebrow="Results" title="Results Approval" description="Approve or return each subject. When every subject of a class is approved, release the class so students and parents can see it." />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Submissions" value={metrics.data?.totalSubmissions ?? "—"} icon={Eye} />
        <StatCard label="Pending review" value={metrics.data?.pendingReview ?? "—"} icon={RotateCcw} tone="amber" />
        <StatCard label="Approved" value={metrics.data?.approved ?? "—"} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Released" value={metrics.data?.released ?? "—"} icon={PartyPopper} tone="violet" />
      </div>

      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select label="Term" value={activeTermId} onChange={(e) => setTermId(e.target.value)}>
            {status.data?.terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}</option>)}
          </Select>
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </div>
      </Panel>

      {queue.loading ? <LoadingSkeleton count={4} /> : queue.error || !queue.data ? <ErrorState message={queue.error ?? undefined} onRetry={queue.reload} /> : queue.data.length === 0 ? (
        <EmptyState title="Nothing here" description="No submissions match these filters." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Class</th><th className="hidden px-5 py-3 md:table-cell">Teacher</th><th className="hidden px-5 py-3 lg:table-cell">Submitted</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-slate-900">{item.subjectName}</td>
                  <td className="px-5 py-3">{item.classLabel}</td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">{item.teacherName ?? "—"}</td>
                  <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{item.submittedToAdminAt ? formatDate(item.submittedToAdminAt) : "—"}</td>
                  <td className="px-5 py-3"><Badge variant={statusTone(item.status)}>{formatStatus(item.status)}</Badge></td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => open(item)}>Review</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog isOpen={detail !== null} onClose={() => setDetail(null)} title={detail ? `${detail.batch.subjectName} — ${detail.batch.classLabel}` : ""} description={detail ? `${detail.batch.termSessionLabel} · ${detail.batch.teacherName ?? ""}` : ""} maxWidth="xl">
        {detail && (
          <div className="space-y-4">
            <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    {detail.scheme?.components.map((c) => <th key={c.key} className="px-2 py-2 text-center">{c.name}</th>)}
                    <th className="px-2 py-2 text-center">Exam</th><th className="px-2 py-2 text-center">Total</th><th className="px-2 py-2 text-center">Grade</th><th className="px-2 py-2 text-center">Pos.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.students.map((s) => (
                    <tr key={s.studentId}>
                      <td className="px-3 py-2 font-semibold">{s.lastName} {s.firstName}</td>
                      {detail.scheme?.components.map((c) => <td key={c.key} className="px-2 py-2 text-center">{s.caComponents?.[c.key] ?? "—"}</td>)}
                      <td className="px-2 py-2 text-center">{s.examScore ?? "—"}</td>
                      <td className="px-2 py-2 text-center font-bold">{s.computedTotal ?? "—"}</td>
                      <td className={`px-2 py-2 text-center font-bold ${gradeColor(s.grade)}`}>{s.grade ?? "—"}</td>
                      <td className="px-2 py-2 text-center text-xs text-slate-500">{s.subjectPositionLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm">
              <span className="text-slate-600">Class progress: <strong>{detail.publishReadiness.approvedSubjects}/{detail.publishReadiness.totalSubjects}</strong> subjects approved</span>
              {detail.publishReadiness.canPublish && <Badge variant="success">Ready to release</Badge>}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {(detail.batch.status === "PENDING_REVIEW" || detail.batch.status === "APPROVED") && (
                <Button variant="outline" onClick={() => setReturning({ item: detail.batch, notes: "" })}><RotateCcw className="mr-1.5 h-4 w-4" /> Return</Button>
              )}
              {detail.batch.status === "PENDING_REVIEW" && (
                <Button isLoading={busy} onClick={() => act("Subject approved.", () => approveBatch(detail.batch.id))}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve</Button>
              )}
              {detail.publishReadiness.canPublish && (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setReleasing({ item: detail.batch, remark: "" })}><PartyPopper className="mr-1.5 h-4 w-4" /> Release class</Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={returning !== null} onClose={() => setReturning(null)} title="Return for correction" description="The class teacher and subject teacher are notified.">
        {returning && (
          <div className="space-y-4">
            <Textarea label="What needs correcting?" value={returning.notes} onChange={(e) => setReturning({ ...returning, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReturning(null)}>Cancel</Button>
              <Button disabled={returning.notes.trim().length < 3} isLoading={busy} onClick={() => { const r = returning; setReturning(null); void act("Returned for correction.", () => returnBatch(r.item.id, r.notes)); }}>Return</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={releasing !== null} onClose={() => setReleasing(null)} title="Release results to students and parents" description="Positions are calculated now and report cards are generated. This cannot be undone.">
        {releasing && (
          <div className="space-y-4">
            <Textarea label="Principal's remark (optional)" value={releasing.remark} onChange={(e) => setReleasing({ ...releasing, remark: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReleasing(null)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" isLoading={busy} onClick={() => { const r = releasing; setReleasing(null); void act("Class results released.", () => releaseClass({ classId: r.item.classId, armId: r.item.armId, termId: r.item.termId, sessionId: r.item.sessionId, principalRemark: r.remark || undefined })); }}>Release now</Button>
            </div>
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
