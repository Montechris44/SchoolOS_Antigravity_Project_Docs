"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { getAcademicStatus, listPortalClasses, listSubjectItems } from "@/lib/api/portal-academics";
import { listStaffMembers } from "@/lib/api/portal-people";
import { createTimetableEntry, deleteTimetableEntry, getStudentTimetable, getTeacherTimetable, listTimetable } from "@/lib/api/portal-daily";
import { DAYS } from "@/components/portal/days";
import { TimetableEntry } from "@/types/portal";

function Week({ entries, canDelete, onDelete, showClass }: { entries: TimetableEntry[]; canDelete?: boolean; onDelete?: (id: string) => void; showClass?: boolean }) {
  const days = entries.some((e) => e.dayOfWeek >= 6) ? DAYS.slice(0, 7).filter((_, i) => i < 6 || entries.some((e) => e.dayOfWeek === 7)) : DAYS.slice(0, 5);
  const today = new Date().getDay() || 7;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5 xl:grid-cols-6">
      {days.map((name, index) => {
        const day = index + 1;
        const items = entries.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={name} className={`rounded-3xl border p-3 ${day === today ? "border-brand bg-brand-soft" : "border-slate-200 bg-white"}`}>
            <p className={`mb-3 px-1 text-xs font-bold uppercase tracking-wider ${day === today ? "text-brand" : "text-slate-400"}`}>{name}</p>
            <div className="space-y-2">
              {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-300">—</p>}
              {items.map((entry) => (
                <div key={entry.id} className={`group rounded-2xl border p-3 text-sm ${entry.isBreak || entry.isLunch ? "border-dashed border-slate-200 bg-slate-50 text-slate-400" : "border-slate-100 bg-white shadow-sm"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-bold text-brand">{entry.startTime}–{entry.endTime}</p>
                    {canDelete && <button onClick={() => onDelete?.(entry.id)} aria-label="Delete lesson" className="opacity-0 transition-opacity group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>}
                  </div>
                  <p className="mt-0.5 font-bold text-slate-800">{entry.displayTitle}</p>
                  <p className="text-[11px] text-slate-500">
                    {[showClass ? `${entry.className}${entry.armName ? ` ${entry.armName}` : ""}` : null, entry.teacherName, entry.room].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminTimetable() {
  const classes = useLoader(listPortalClasses, []);
  const subjects = useLoader(listSubjectItems, []);
  const teachers = useLoader(() => listStaffMembers({ role: "teacher" }), []);
  const status = useLoader(getAcademicStatus, []);
  const [classId, setClassId] = useState("");
  const [armId, setArmId] = useState("");
  const activeClassId = classId || classes.data?.[0]?.id || "";
  const arms = classes.data?.find((c) => c.id === activeClassId)?.arms ?? [];

  const entries = useLoader(() => (activeClassId ? listTimetable({ classId: activeClassId, armId: armId || undefined, termId: status.data?.currentTerm?.id }) : Promise.resolve([])), [activeClassId, armId, status.data?.currentTerm?.id]);
  const [form, setForm] = useState<{ dayOfWeek: number; startTime: string; endTime: string; subjectId: string; teacherId: string; room: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setNotice(null);
    try {
      await createTimetableEntry({
        classId: activeClassId,
        armId: armId || null,
        termId: status.data?.currentTerm?.id ?? null,
        subjectId: form.subjectId || null,
        teacherId: form.teacherId || null,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || null,
      });
      setForm(null);
      entries.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not add the lesson." });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Teaching & learning"
        title="Timetable"
        description="Build the weekly timetable class by class. Clashes for a class, a teacher or a room are blocked automatically."
        actions={<Button onClick={() => setForm({ dayOfWeek: 1, startTime: "08:00", endTime: "08:40", subjectId: "", teacherId: "", room: "" })} disabled={!activeClassId}><Plus className="mr-2 h-4 w-4" /> Add lesson</Button>}
      />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}
      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select label="Class" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setArmId(""); }}>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Arm" value={armId} onChange={(e) => setArmId(e.target.value)} disabled={arms.length === 0}>
            <option value="">{arms.length ? "Whole class" : "No arms"}</option>
            {arms.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
      </Panel>

      {entries.loading ? <LoadingSkeleton count={3} /> : entries.error ? <ErrorState message={entries.error} onRetry={entries.reload} /> : (entries.data ?? []).length === 0 ? (
        <EmptyState title="No lessons yet" description="Add the first lesson for this class." />
      ) : (
        <Week entries={entries.data ?? []} canDelete onDelete={async (id) => { try { await deleteTimetableEntry(id); entries.reload(); } catch (err) { setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not delete." }); } }} />
      )}

      <Dialog isOpen={form !== null} onClose={() => setForm(null)} title="Add a lesson" description="Leave subject empty for a break or assembly, and put the name in Room / label.">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Select label="Day" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Starts" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <Input label="Ends" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">— none (break) —</option>
              {subjects.data?.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">— none —</option>
              {teachers.data?.filter((t) => t.isActive).map((t) => <option key={t.userId} value={t.userId}>{t.firstName} {t.lastName}</option>)}
            </Select>
            <Input label="Room / label" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Add lesson</Button></div>
          </form>
        )}
      </Dialog>
    </>
  );
}

function PersonalTimetable({ mode }: { mode: "student" | "teacher" }) {
  const entries = useLoader(mode === "student" ? getStudentTimetable : getTeacherTimetable, [mode]);
  return (
    <>
      <PageHeader eyebrow="Teaching & learning" title={mode === "student" ? "My Timetable" : "My Teaching Timetable"} description="Your week at a glance. Today is highlighted." />
      {entries.loading ? <LoadingSkeleton count={3} /> : entries.error ? <ErrorState message={entries.error} onRetry={entries.reload} /> : (entries.data ?? []).length === 0 ? (
        <EmptyState title="No timetable yet" description="The school administrator has not published lessons for you yet." />
      ) : (
        <Week entries={entries.data ?? []} showClass={mode === "teacher"} />
      )}
    </>
  );
}

export default function TimetablePage() {
  const { role } = useAuth();
  return (
    <AppShell allow={["owner", "admin", "teacher", "student"]}>
      {role === "student" ? <PersonalTimetable mode="student" /> : role === "teacher" ? <PersonalTimetable mode="teacher" /> : <AdminTimetable />}
    </AppShell>
  );
}
