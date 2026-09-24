"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lock, Plus, Save, Send, Settings2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { getAcademicStatus, getEntrySheet, getGradeBands, listMyResultClasses, publishSubject, saveScheme, saveScores } from "@/lib/api/portal-academics";
import { gradeColor, gradeFor } from "@/lib/grades";
import { BatchStatus, EntrySheet } from "@/types/portal";

const LOCKED: BatchStatus[] = ["PENDING_REVIEW", "APPROVED", "PUBLISHED"];

interface RowState {
  ca: Record<string, string>;
  exam: string;
  remark: string;
  dirty: boolean;
}

const toText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toNum = (s: string): number | null => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

export default function ResultsEntryPage() {
  const status = useLoader(getAcademicStatus, []);
  const myClasses = useLoader(listMyResultClasses, []);
  const bands = useLoader(getGradeBands, []);

  const [assignmentId, setAssignmentId] = useState("");
  const [termId, setTermId] = useState("");
  const [sheet, setSheet] = useState<EntrySheet | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [editingScheme, setEditingScheme] = useState(false);
  const [schemeDraft, setSchemeDraft] = useState<Array<{ name: string; maxScore: string }>>([]);
  const [examMax, setExamMax] = useState("60");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const assignment = myClasses.data?.find((a) => a.id === assignmentId) ?? null;
  const currentTerm = status.data?.terms.find((t) => t.id === (termId || status.data?.currentTerm?.id)) ?? null;
  const scope = useMemo(
    () => (assignment && currentTerm ? { classId: assignment.classId, armId: assignment.armId, subjectId: assignment.subjectId, termId: currentTerm.id, sessionId: currentTerm.sessionId } : null),
    [assignment, currentTerm]
  );

  const loadSheet = async () => {
    if (!scope) return;
    setSheetLoading(true);
    setSheetError(null);
    try {
      const result = await getEntrySheet(scope);
      setSheet(result);
      const next: Record<string, RowState> = {};
      for (const student of result.students) {
        const ca: Record<string, string> = {};
        for (const component of result.scheme?.components ?? []) ca[component.key] = toText(student.caComponents?.[component.key]);
        next[student.studentId] = { ca, exam: student.scoresComplete ? toText(student.examScore) : "", remark: student.subjectRemark ?? "", dirty: false };
      }
      setRows(next);
      setEditingScheme(!result.scheme);
      if (result.scheme) {
        setSchemeDraft(result.scheme.components.map((c) => ({ name: c.name, maxScore: String(c.max_score) })));
        setExamMax(String(result.scheme.examMaxScore));
      } else {
        setSchemeDraft([{ name: "CA 1", maxScore: "20" }, { name: "CA 2", maxScore: "20" }]);
        setExamMax("60");
      }
    } catch (err) {
      setSheet(null);
      setSheetError(err instanceof ApiError ? err.message : "Could not load this class.");
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    setSheet(null);
    setNotice(null);
    if (scope) void loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, currentTerm?.id]);

  const locked = sheet ? LOCKED.includes(sheet.batch.status) : false;
  const termClosed = currentTerm ? !currentTerm.isActive : false;
  const schemeTotal = schemeDraft.reduce((sum, c) => sum + (toNum(c.maxScore) ?? 0), 0) + (toNum(examMax) ?? 0);

  const persistScheme = async () => {
    if (!scope) return;
    setBusy(true);
    setNotice(null);
    try {
      await saveScheme(scope, schemeDraft.map((c) => ({ name: c.name.trim(), maxScore: Number(c.maxScore) })), Number(examMax));
      setNotice({ tone: "success", text: "Scheme saved. You can now enter scores." });
      await loadSheet();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save the scheme." });
    } finally {
      setBusy(false);
    }
  };

  const totalOf = (state: RowState): number | null => {
    if (!sheet?.scheme) return null;
    const values = sheet.scheme.components.map((c) => toNum(state.ca[c.key] ?? ""));
    const exam = toNum(state.exam);
    if (values.some((v) => v === null) || exam === null) return null;
    return (values as number[]).reduce((a, b) => a + b, 0) + exam;
  };

  const outOfRange = (state: RowState): string | null => {
    if (!sheet?.scheme) return null;
    for (const c of sheet.scheme.components) {
      const v = toNum(state.ca[c.key] ?? "");
      if (v !== null && (v < 0 || v > c.max_score)) return `${c.name} must be 0–${c.max_score}`;
    }
    const exam = toNum(state.exam);
    if (exam !== null && (exam < 0 || exam > sheet.scheme.examMaxScore)) return `Exam must be 0–${sheet.scheme.examMaxScore}`;
    return null;
  };

  const persistScores = async (): Promise<boolean> => {
    if (!scope || !sheet?.scheme) return false;
    const dirty = Object.entries(rows).filter(([, r]) => r.dirty);
    if (dirty.length === 0) return true;
    const invalid = dirty.find(([, r]) => outOfRange(r));
    if (invalid) {
      setNotice({ tone: "error", text: outOfRange(invalid[1]) ?? "A score is out of range." });
      return false;
    }
    setBusy(true);
    setNotice(null);
    try {
      await saveScores(
        scope,
        dirty.map(([studentId, r]) => ({
          studentId,
          caComponents: Object.fromEntries(sheet.scheme!.components.map((c) => [c.key, toNum(r.ca[c.key] ?? "")])),
          examScore: toNum(r.exam),
          remark: r.remark || null,
        }))
      );
      setNotice({ tone: "success", text: `Saved ${dirty.length} student(s).` });
      await loadSheet();
      return true;
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save scores." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!scope) return;
    if (!(await persistScores())) return;
    setBusy(true);
    try {
      await publishSubject(scope);
      setNotice({ tone: "success", text: "Submitted to the class teacher." });
      await loadSheet();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not submit." });
    } finally {
      setBusy(false);
    }
  };

  const update = (studentId: string, patch: Partial<RowState>) => setRows((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch, dirty: true } }));

  return (
    <AppShell allow={["owner", "admin", "teacher"]}>
      <PageHeader eyebrow="Results" title="Results Entry" description="Define how the 100 marks are split, enter CA and exam scores, then submit the subject to the class teacher." />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <Panel className="mb-6">
        {myClasses.loading || status.loading ? <LoadingSkeleton count={1} /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select label="Class & subject" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              <option value="">Choose…</option>
              {myClasses.data?.map((a) => <option key={a.id} value={a.id}>{a.subjectName} — {a.classLabel}</option>)}
            </Select>
            <Select label="Term" value={termId || status.data?.currentTerm?.id || ""} onChange={(e) => setTermId(e.target.value)}>
              {status.data?.terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (current)" : ""}{!t.isActive ? " — closed" : ""}</option>)}
            </Select>
            <div className="flex items-end">
              {sheet && <Badge variant={statusTone(sheet.batch.status)}>{formatStatus(sheet.batch.status)}</Badge>}
            </div>
          </div>
        )}
        {myClasses.data?.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">You have no class assignments yet. Ask the school administrator to assign you to a class and subject.</p>
        )}
      </Panel>

      {termClosed && <Alert tone="warning" className="mb-4"><Lock className="mr-1 inline h-3.5 w-3.5" /> This term is closed. Only the administrator can change its data.</Alert>}

      {!assignment ? (
        <EmptyState title="Choose a class and subject" description="Pick one of your teaching assignments above to begin." />
      ) : sheetLoading ? (
        <LoadingSkeleton count={5} />
      ) : sheetError ? (
        <ErrorState message={sheetError} onRetry={loadSheet} />
      ) : sheet && (
        <div className="space-y-6">
          {sheet.batch.status === "RETURNED_FOR_CORRECTION" && sheet.batch.reviewNotes && (
            <Alert tone="warning"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Returned for correction: {sheet.batch.reviewNotes}</Alert>
          )}
          {locked && <Alert tone="info"><Lock className="mr-1 inline h-3.5 w-3.5" /> These scores are with the administrator and can no longer be edited.</Alert>}

          <Panel
            title="Assessment scheme"
            action={sheet.scheme && !editingScheme && !locked && <Button size="sm" variant="outline" onClick={() => setEditingScheme(true)}><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Edit scheme</Button>}
          >
            {editingScheme ? (
              <div className="space-y-3">
                {schemeDraft.map((c, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <Input label={i === 0 ? "Component" : undefined} value={c.name} onChange={(e) => setSchemeDraft(schemeDraft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input label={i === 0 ? "Max marks" : undefined} type="number" min={1} className="w-28" value={c.maxScore} onChange={(e) => setSchemeDraft(schemeDraft.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))} />
                    <Button type="button" size="icon" variant="ghost" disabled={schemeDraft.length === 1} onClick={() => setSchemeDraft(schemeDraft.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={schemeDraft.length >= 8} onClick={() => setSchemeDraft([...schemeDraft, { name: `CA ${schemeDraft.length + 1}`, maxScore: "10" }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add CA</Button>
                  <Input label="Exam max marks" type="number" min={1} className="w-32" value={examMax} onChange={(e) => setExamMax(e.target.value)} />
                  <span className={`pb-2 text-sm font-bold ${Math.abs(schemeTotal - 100) < 0.01 ? "text-emerald-600" : "text-rose-600"}`}>Total {schemeTotal} / 100</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={persistScheme} isLoading={busy} disabled={Math.abs(schemeTotal - 100) > 0.01}>Save scheme</Button>
                  {sheet.scheme && <Button variant="ghost" onClick={() => setEditingScheme(false)}>Cancel</Button>}
                </div>
              </div>
            ) : sheet.scheme && (
              <div className="flex flex-wrap gap-2">
                {sheet.scheme.components.map((c) => <Badge key={c.key} variant="secondary">{c.name}: {c.max_score}</Badge>)}
                <Badge variant="default">Exam: {sheet.scheme.examMaxScore}</Badge>
              </div>
            )}
          </Panel>

          {sheet.scheme && !editingScheme && (
            <Panel title={`Scores — ${assignment.subjectName}, ${assignment.classLabel}`} action={
              !locked && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void persistScores()} isLoading={busy}><Save className="mr-1.5 h-4 w-4" /> Save</Button>
                  <Button onClick={publish} isLoading={busy}><Send className="mr-1.5 h-4 w-4" /> Submit to class teacher</Button>
                </div>
              )
            }>
              {sheet.students.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No active students in this class.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Student</th>
                        {sheet.scheme.components.map((c) => <th key={c.key} className="py-3 px-2 text-center">{c.name}<span className="block font-normal normal-case text-slate-400">/{c.max_score}</span></th>)}
                        <th className="py-3 px-2 text-center">Exam<span className="block font-normal normal-case text-slate-400">/{sheet.scheme.examMaxScore}</span></th>
                        <th className="py-3 px-2 text-center">Total</th>
                        <th className="py-3 text-center">Grade</th>
                        <th className="py-3 px-3 text-center">Pos.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sheet.students.map((student) => {
                        const state = rows[student.studentId];
                        if (!state) return null;
                        const total = totalOf(state);
                        const grade = gradeFor(total, bands.data ?? []);
                        const problem = outOfRange(state);
                        return (
                          <tr key={student.studentId} className={`transition-colors hover:bg-slate-50/60 ${problem ? "bg-rose-50/80" : ""}`}>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-900">{student.lastName} {student.firstName}</p>
                              <p className="font-mono text-[11px] text-slate-400">{student.admissionNumber}</p>
                            </td>
                            {sheet.scheme!.components.map((c) => (
                              <td key={c.key} className="py-2.5 px-2 text-center">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={c.max_score}
                                  disabled={locked}
                                  value={state.ca[c.key] ?? ""}
                                  onChange={(e) => update(student.studentId, { ca: { ...state.ca, [c.key]: e.target.value } })}
                                  className="h-9 w-16 rounded-xl border border-slate-200 bg-slate-50/50 text-center text-sm font-bold text-slate-800 outline-none transition-all focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100/60"
                                />
                              </td>
                            ))}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={sheet.scheme!.examMaxScore}
                                disabled={locked}
                                value={state.exam}
                                onChange={(e) => update(student.studentId, { exam: e.target.value })}
                                className="h-9 w-16 rounded-xl border border-slate-200 bg-slate-50/50 text-center text-sm font-bold text-slate-800 outline-none transition-all focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100/60"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center font-heading text-base font-black text-slate-900">{total ?? "—"}</td>
                            <td className={`py-2.5 text-center font-bold font-mono text-sm ${gradeColor(grade?.grade)}`}>{grade?.grade ?? "—"}</td>
                            <td className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500">{state.dirty ? "•" : student.subjectPositionLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-400">A total and grade appear only when every CA and the exam are filled. Submitting needs every student complete.</p>
            </Panel>
          )}
        </div>
      )}
    </AppShell>
  );
}
