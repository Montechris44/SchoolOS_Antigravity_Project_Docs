"use client";

import React, { useRef, useState } from "react";
import { ClipboardList, Paperclip, Plus, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, Textarea, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { listMyResultClasses, listPortalClasses, listSubjectItems } from "@/lib/api/portal-academics";
import { attachHomeworkFile, createHomework, deleteHomework, gradeSubmission, listHomework, listMyHomework, listSubmissions, submitHomework } from "@/lib/api/portal-daily";
import { HomeworkItem, SubmissionRow } from "@/types/portal";
import { formatDate } from "@/lib/utils";

function TeacherView() {
  const classes = useLoader(listPortalClasses, []);
  const subjects = useLoader(listSubjectItems, []);
  const mine = useLoader(listMyResultClasses, []);
  const list = useLoader(() => listHomework(), []);
  const [form, setForm] = useState<{ classId: string; armId: string; subjectId: string; title: string; description: string; points: string; dueDate: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [viewing, setViewing] = useState<{ assignment: HomeworkItem; submissions: SubmissionRow[] } | null>(null);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});

  const myClassIds = new Set(mine.data?.map((a) => a.classId));
  const selectable = classes.data?.filter((c) => myClassIds.size === 0 || myClassIds.has(c.id)) ?? [];
  const arms = classes.data?.find((c) => c.id === form?.classId)?.arms ?? [];

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setNotice(null);
    try {
      await createHomework({ classId: form.classId, armId: form.armId || null, subjectId: form.subjectId || null, title: form.title, description: form.description || undefined, points: Number(form.points) || 100, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null });
      setForm(null);
      setNotice({ tone: "success", text: "Homework posted. Students in the class were notified." });
      list.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not post the homework." });
    }
  };

  const open = async (item: HomeworkItem) => {
    try {
      setViewing(await listSubmissions(item.id));
      setGrades({});
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not load submissions." });
    }
  };

  const grade = async (row: SubmissionRow) => {
    const draft = grades[row.studentId];
    if (!viewing || !draft) return;
    try {
      await gradeSubmission(viewing.assignment.id, row.studentId, Number(draft.score), draft.feedback || undefined);
      setViewing(await listSubmissions(viewing.assignment.id));
      list.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save the grade." });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Teaching & learning"
        title="Homework"
        description="Set homework for a class, see who has handed in, and grade the work."
        actions={<Button onClick={() => setForm({ classId: selectable[0]?.id ?? "", armId: "", subjectId: "", title: "", description: "", points: "100", dueDate: "" })}><Plus className="mr-2 h-4 w-4" /> New homework</Button>}
      />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {list.loading ? <LoadingSkeleton count={4} /> : list.error || !list.data ? <ErrorState message={list.error ?? undefined} onRetry={list.reload} /> : list.data.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No homework yet" description="Post homework and your students will see it on their dashboard." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.data.map((item) => (
            <Panel key={item.id} className="!p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-heading font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-500">{item.className}{item.armName ? ` ${item.armName}` : ""}{item.subjectName ? ` · ${item.subjectName}` : ""}</p>
                </div>
                <Badge variant="secondary">{item.points} pts</Badge>
              </div>
              {item.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">Due {item.dueDate ? formatDate(item.dueDate) : "—"} · {item.submittedCount ?? 0} handed in · {item.gradedCount ?? 0} graded</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => open(item)}>Submissions</Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={async () => { if (window.confirm("Delete this homework and its submissions?")) { await deleteHomework(item.id).catch(() => undefined); list.reload(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog isOpen={form !== null} onClose={() => setForm(null)} title="New homework" maxWidth="lg">
        {form && (
          <form onSubmit={create} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Class" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, armId: "" })}>
                {selectable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Arm" value={form.armId} onChange={(e) => setForm({ ...form, armId: e.target.value })} disabled={arms.length === 0}>
                <option value="">{arms.length ? "Whole class" : "No arms"}</option>
                {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">General</option>
                {subjects.data?.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea label="Instructions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Points" type="number" min={1} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
              <Input label="Due" type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Post homework</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={viewing !== null} onClose={() => setViewing(null)} title={viewing?.assignment.title ?? ""} description={viewing ? `Out of ${viewing.assignment.points}` : ""} maxWidth="xl">
        {viewing && (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {viewing.submissions.map((row) => (
              <div key={row.studentId} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{row.lastName} {row.firstName}</p>
                  <Badge variant={statusTone(row.status)}>{formatStatus(row.status)}</Badge>
                </div>
                {row.submissionText && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{row.submissionText}</p>}
                {row.files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{row.files.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Paperclip className="h-3 w-3" />{f.name}</a>)}</div>}
                {(row.status === "SUBMITTED" || row.status === "GRADED") && (
                  <div className="mt-3 flex items-end gap-2">
                    <Input label="Score" type="number" min={0} className="w-24" value={grades[row.studentId]?.score ?? (row.gradeScore ?? "").toString()} onChange={(e) => setGrades({ ...grades, [row.studentId]: { score: e.target.value, feedback: grades[row.studentId]?.feedback ?? row.feedback ?? "" } })} />
                    <Input label="Feedback" value={grades[row.studentId]?.feedback ?? row.feedback ?? ""} onChange={(e) => setGrades({ ...grades, [row.studentId]: { score: grades[row.studentId]?.score ?? (row.gradeScore ?? "").toString(), feedback: e.target.value } })} />
                    <Button size="sm" onClick={() => grade(row)} disabled={!(grades[row.studentId]?.score ?? row.gradeScore)}>Save</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}

function StudentView() {
  const list = useLoader(listMyHomework, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<HomeworkItem | null>(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (status: "IN_PROGRESS" | "SUBMITTED") => {
    if (!open) return;
    setBusy(true);
    setNotice(null);
    try {
      await submitHomework(open.id, text, status);
      setOpen(null);
      list.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save your work." });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!open) return;
    try {
      await attachHomeworkFile(open.id, file);
      setNotice({ tone: "success", text: `${file.name} attached.` });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not upload the file." });
    }
  };

  return (
    <>
      <PageHeader eyebrow="My school" title="Homework" description="Everything your teachers have set for your class." />
      {list.loading ? <LoadingSkeleton count={4} /> : list.error || !list.data ? <ErrorState message={list.error ?? undefined} onRetry={list.reload} /> : list.data.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No homework right now" description="New homework will appear here as soon as your teachers post it." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.data.map((item) => {
            const overdue = item.dueDate && new Date(item.dueDate) < new Date() && (item.submissionStatus === "NOT_STARTED" || item.submissionStatus === "IN_PROGRESS");
            return (
              <Panel key={item.id} className="!p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-heading font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500">{item.subjectName ?? "General"} · {item.teacherName ?? "Teacher"}</p>
                  </div>
                  <Badge variant={overdue ? "destructive" : statusTone(item.submissionStatus ?? "NOT_STARTED")}>{overdue ? "Overdue" : formatStatus(item.submissionStatus ?? "NOT_STARTED")}</Badge>
                </div>
                {item.description && <p className="mt-2 text-sm text-slate-600">{item.description}</p>}
                {item.submissionStatus === "GRADED" && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Score: {item.gradeScore}/{item.points}{item.feedback ? ` — ${item.feedback}` : ""}</p>}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Due {item.dueDate ? formatDate(item.dueDate) : "—"} · {item.points} pts</span>
                  {item.submissionStatus !== "GRADED" && <Button size="sm" onClick={() => { setOpen(item); setText(item.submissionText ?? ""); setNotice(null); }}>{item.submissionStatus === "SUBMITTED" ? "Update" : "Open"}</Button>}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog isOpen={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ""} description={open ? `Due ${open.dueDate ? formatDate(open.dueDate) : "—"}` : ""} maxWidth="lg">
        {open && (
          <div className="space-y-4">
            {open.description && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{open.description}</p>}
            <Textarea label="Your answer" value={text} onChange={(e) => setText(e.target.value)} />
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Paperclip className="mr-1.5 h-3.5 w-3.5" /> Attach a photo or PDF</Button>
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => submit("IN_PROGRESS")} disabled={busy}>Save draft</Button>
              <Button onClick={() => submit("SUBMITTED")} isLoading={busy}><Send className="mr-1.5 h-4 w-4" /> Hand in</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

export default function AssignmentsPage() {
  const { role } = useAuth();
  return (
    <AppShell allow={["owner", "admin", "teacher", "student"]}>
      {role === "student" ? <StudentView /> : <TeacherView />}
    </AppShell>
  );
}
