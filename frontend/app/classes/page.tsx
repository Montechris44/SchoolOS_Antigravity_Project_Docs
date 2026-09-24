"use client";

import React, { useState } from "react";
import { BookPlus, Layers, Plus, Trash2, UserCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, Tabs, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import {
  addSubjectsFromCatalog,
  assignArmTeacher,
  assignClassTeacher,
  clearArmTeacher,
  clearClassTeacher,
  createArm,
  createPortalClass,
  createSubjectItem,
  createTeacherAssignment,
  deleteArm,
  deleteClass,
  deleteTeacherAssignment,
  listPortalClasses,
  listSubjectCatalog,
  listSubjectItems,
  listTeacherAssignments,
  toggleSubjectItem,
} from "@/lib/api/portal-academics";
import { listStaffMembers } from "@/lib/api/portal-people";

type Tab = "classes" | "subjects" | "assignments";

export default function ClassesPage() {
  const [tab, setTab] = useState<Tab>("classes");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const classes = useLoader(listPortalClasses, []);
  const subjects = useLoader(listSubjectItems, []);
  const teachers = useLoader(() => listStaffMembers({ role: "teacher" }), []);
  const assignments = useLoader(() => listTeacherAssignments(), []);

  const run = async (text: string, action: () => Promise<unknown>, refresh: Array<() => void>) => {
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text });
      refresh.forEach((fn) => fn());
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work. Please try again." });
    }
  };

  // --- class form
  const [classForm, setClassForm] = useState<{ name: string; gradeLevel: string; level: string } | null>(null);
  // --- arm form
  const [armFor, setArmFor] = useState<{ classId: string; name: string } | null>(null);
  // --- teacher picker (class or arm)
  const [teacherFor, setTeacherFor] = useState<{ kind: "class" | "arm"; id: string; label: string; teacherId: string } | null>(null);
  // --- subjects
  const [subjectForm, setSubjectForm] = useState<{ name: string; code: string } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalog = useLoader(listSubjectCatalog, [catalogOpen]);
  const [picked, setPicked] = useState<string[]>([]);
  // --- assignments
  const [assignForm, setAssignForm] = useState({ teacherId: "", classId: "", armId: "", subjectId: "" });

  const activeTeachers = teachers.data?.filter((t) => t.isActive) ?? [];
  const armsOfSelected = classes.data?.find((c) => c.id === assignForm.classId)?.arms ?? [];

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader eyebrow="Academic structure" title="Classes & Subjects" description="Set up classes and arms, choose each class teacher, and decide who teaches which subject." />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <Tabs
        tabs={[
          { id: "classes" as Tab, label: "Classes & arms", count: classes.data?.length },
          { id: "subjects" as Tab, label: "Subjects", count: subjects.data?.length },
          { id: "assignments" as Tab, label: "Teaching assignments", count: assignments.data?.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "classes" && (
        <>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setClassForm({ name: "", gradeLevel: "", level: "" })}><Plus className="mr-2 h-4 w-4" /> Add class</Button>
          </div>
          {classes.loading ? <LoadingSkeleton count={3} /> : classes.error || !classes.data ? <ErrorState message={classes.error ?? undefined} onRetry={classes.reload} /> : classes.data.length === 0 ? (
            <EmptyState icon={Layers} title="No classes yet" description="Create your first class, e.g. JSS 1, then add arms like A and B." actionLabel="Add class" onAction={() => setClassForm({ name: "", gradeLevel: "", level: "" })} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {classes.data.map((cls) => (
                <Panel key={cls.id} className="group relative overflow-hidden !p-5 border-slate-200/80 hover:shadow-card-hover transition-all">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-brand-strong opacity-80" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-slate-900 group-hover:text-brand transition-colors">{cls.name}</h3>
                      <p className="text-xs font-medium text-slate-500">{cls.studentCount} student{cls.studentCount === 1 ? "" : "s"} enrolled</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setArmFor({ classId: cls.id, name: "" })}><Plus className="mr-1 h-3.5 w-3.5" /> Arm</Button>
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => { if (window.confirm(`Delete ${cls.name}?`)) void run("Class deleted.", () => deleteClass(cls.id), [classes.reload]); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {cls.arms.length === 0 ? (
                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm">
                      <span className="text-slate-600">Class teacher: <strong className="font-semibold text-slate-900">{cls.classTeacherName ?? "Not assigned"}</strong></span>
                      <Button size="sm" variant="outline" onClick={() => setTeacherFor({ kind: "class", id: cls.id, label: cls.name, teacherId: cls.classTeacherId ?? "" })}><UserCheck className="mr-1.5 h-3.5 w-3.5" /> Assign teacher</Button>
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {cls.arms.map((arm) => (
                        <li key={arm.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-sm">
                          <div>
                            <span className="font-bold text-slate-800">Arm {arm.name}</span>
                            <span className="ml-2 text-xs text-slate-500">{arm.studentCount} student{arm.studentCount === 1 ? "" : "s"} · Teacher: <span className="font-medium text-slate-700">{arm.classTeacherName ?? "None"}</span></span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setTeacherFor({ kind: "arm", id: arm.id, label: `${cls.name} ${arm.name}`, teacherId: arm.classTeacherId ?? "" })}><UserCheck className="mr-1 h-3.5 w-3.5" /> Teacher</Button>
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => { if (window.confirm(`Delete arm ${arm.name}?`)) void run("Arm deleted.", () => deleteArm(arm.id), [classes.reload]); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "subjects" && (
        <>
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => { setPicked([]); setCatalogOpen(true); }}><BookPlus className="mr-2 h-4 w-4" /> Add from catalogue</Button>
            <Button onClick={() => setSubjectForm({ name: "", code: "" })}><Plus className="mr-2 h-4 w-4" /> Custom subject</Button>
          </div>
          {subjects.loading ? <LoadingSkeleton count={4} /> : subjects.error || !subjects.data ? <ErrorState message={subjects.error ?? undefined} onRetry={subjects.reload} /> : subjects.data.length === 0 ? (
            <EmptyState title="No subjects yet" description="Pick from the Nigerian curriculum catalogue or add your own." actionLabel="Browse catalogue" onAction={() => setCatalogOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.data.map((subject) => (
                <Panel key={subject.id} className="group relative overflow-hidden !p-4 border-slate-200/80 hover:shadow-card-hover transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-brand transition-colors">{subject.name}</p>
                      <p className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">{subject.code}</p>
                    </div>
                    <Badge variant={subject.isActive ? "success" : "secondary"}>{subject.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="font-medium text-slate-400">{subject.source === "GLOBAL" ? "National curriculum" : "Custom subject"}</span>
                    <button className="font-semibold text-brand hover:underline" onClick={() => run(subject.isActive ? "Subject deactivated." : "Subject activated.", () => toggleSubjectItem(subject.id), [subjects.reload])}>
                      {subject.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "assignments" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel title="Assign a teacher" className="lg:col-span-1">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("Assignment saved.", () => createTeacherAssignment({ teacherId: assignForm.teacherId, classId: assignForm.classId, armId: assignForm.armId || null, subjectId: assignForm.subjectId }), [assignments.reload]);
              }}
            >
              <Select label="Teacher" required value={assignForm.teacherId} onChange={(e) => setAssignForm({ ...assignForm, teacherId: e.target.value })}>
                <option value="" disabled>Select teacher</option>
                {activeTeachers.map((t) => <option key={t.userId} value={t.userId}>{t.firstName} {t.lastName}</option>)}
              </Select>
              <Select label="Class" required value={assignForm.classId} onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value, armId: "" })}>
                <option value="" disabled>Select class</option>
                {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label="Arm" value={assignForm.armId} onChange={(e) => setAssignForm({ ...assignForm, armId: e.target.value })} disabled={armsOfSelected.length === 0}>
                <option value="">{armsOfSelected.length ? "Whole class" : "No arms"}</option>
                {armsOfSelected.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select label="Subject" required value={assignForm.subjectId} onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}>
                <option value="" disabled>Select subject</option>
                {subjects.data?.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Button type="submit" className="w-full">Assign</Button>
            </form>
          </Panel>

          <Panel title="Current assignments" className="lg:col-span-2">
            {assignments.loading ? <LoadingSkeleton count={4} /> : !assignments.data?.length ? (
              <p className="py-8 text-center text-sm text-slate-400">No assignments yet. Teachers can only enter results for subjects assigned to them.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {assignments.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3 px-3 rounded-xl text-sm transition-colors hover:bg-slate-50/80">
                    <div>
                      <p className="font-bold text-slate-900">{a.teacherName}</p>
                      <p className="text-xs text-slate-500 mt-0.5"><span className="font-medium text-slate-700">{a.subjectName}</span> · <span className="font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded text-[11px]">{a.classLabel}</span></p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => run("Assignment removed.", () => deleteTeacherAssignment(a.id), [assignments.reload])}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <Dialog isOpen={classForm !== null} onClose={() => setClassForm(null)} title="Add a class">
        {classForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Class created.", () => createPortalClass({ name: classForm.name, gradeLevel: classForm.gradeLevel || classForm.name, level: classForm.level ? Number(classForm.level) : undefined }), [classes.reload]).then(() => setClassForm(null)); }}>
            <Input label="Class name" required placeholder="JSS 1" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
            <Input label="Grade level" placeholder="JSS 1" value={classForm.gradeLevel} onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value })} />
            <Input label="Order (for sorting)" type="number" min={0} placeholder="7" value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setClassForm(null)}>Cancel</Button><Button type="submit">Create class</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={armFor !== null} onClose={() => setArmFor(null)} title="Add an arm" description="Arms split a class into groups such as A, B or Gold.">
        {armFor && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Arm added.", () => createArm({ classId: armFor.classId, name: armFor.name }), [classes.reload]).then(() => setArmFor(null)); }}>
            <Input label="Arm name" required placeholder="A" value={armFor.name} onChange={(e) => setArmFor({ ...armFor, name: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setArmFor(null)}>Cancel</Button><Button type="submit">Add arm</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={teacherFor !== null} onClose={() => setTeacherFor(null)} title={teacherFor ? `Class teacher — ${teacherFor.label}` : ""} description="A teacher can be class teacher of one class or arm only. They review subject results before the administrator.">
        {teacherFor && (
          <div className="space-y-4">
            <Select label="Teacher" value={teacherFor.teacherId} onChange={(e) => setTeacherFor({ ...teacherFor, teacherId: e.target.value })}>
              <option value="">— choose —</option>
              {activeTeachers.map((t) => <option key={t.userId} value={t.userId}>{t.firstName} {t.lastName}</option>)}
            </Select>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => void run("Class teacher removed.", () => (teacherFor.kind === "arm" ? clearArmTeacher(teacherFor.id) : clearClassTeacher(teacherFor.id)), [classes.reload]).then(() => setTeacherFor(null))}>Remove</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setTeacherFor(null)}>Cancel</Button>
                <Button disabled={!teacherFor.teacherId} onClick={() => void run("Class teacher assigned.", () => (teacherFor.kind === "arm" ? assignArmTeacher(teacherFor.id, teacherFor.teacherId) : assignClassTeacher(teacherFor.id, teacherFor.teacherId)), [classes.reload, teachers.reload]).then(() => setTeacherFor(null))}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={subjectForm !== null} onClose={() => setSubjectForm(null)} title="Add a custom subject">
        {subjectForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Subject added.", () => createSubjectItem(subjectForm), [subjects.reload]).then(() => setSubjectForm(null)); }}>
            <Input label="Subject name" required value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
            <Input label="Code" required maxLength={20} placeholder="MTH" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSubjectForm(null)}>Cancel</Button><Button type="submit">Add subject</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} title="Subject catalogue" description="Tick the subjects your school teaches." maxWidth="xl">
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {catalog.loading ? <LoadingSkeleton count={4} /> : catalog.data?.map((subject) => (
            <label key={subject.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${subject.alreadyAdded ? "opacity-50" : "cursor-pointer hover:bg-slate-50"}`}>
              <input type="checkbox" disabled={subject.alreadyAdded} checked={picked.includes(subject.id)} onChange={(e) => setPicked((prev) => e.target.checked ? [...prev, subject.id] : prev.filter((id) => id !== subject.id))} />
              <span className="flex-1 font-medium text-slate-800">{subject.name}</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">{subject.category}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCatalogOpen(false)}>Cancel</Button>
          <Button disabled={picked.length === 0} onClick={() => void run(`${picked.length} subject(s) added.`, () => addSubjectsFromCatalog(picked), [subjects.reload]).then(() => setCatalogOpen(false))}>Add {picked.length || ""} selected</Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
