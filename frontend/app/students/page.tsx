"use client";

import React, { useRef, useState } from "react";
import { Camera, KeyRound, Plus, Search, UserCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, Avatar, PageHeader, Panel, useLoader } from "@/components/ui/portal";
import { CredentialsDialog, CredentialRow } from "@/components/portal/credentials-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { getPortalSettings, listPortalClasses } from "@/lib/api/portal-academics";
import {
  CreateStudentBody,
  createStudentPortalAccount,
  enrollStudent,
  getStudentSummary,
  listStudentRecords,
  resetStudentPassword,
  updateStudentRecord,
  uploadStudentPhoto,
} from "@/lib/api/portal-people";
import { PeopleFormFields, peopleFormBody } from "@/components/portal/people-form-fields";
import { PeopleImport } from "@/components/portal/people-import";
import { StudentRecord } from "@/types/portal";

export default function StudentsPage() {
  const { can } = useAuth();
  const canManage = can("students:manage");
  const photoInput = useRef<HTMLInputElement>(null);

  const [classFilter, setClassFilter] = useState("");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");

  const classes = useLoader(listPortalClasses, []);
  const settings = useLoader(getPortalSettings, []);
  const students = useLoader(() => listStudentRecords({ classId: classFilter || undefined, status: status || undefined, search: search || undefined }), [classFilter, status, search]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getStudentSummary>> | null>(null);

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const created = await enrollStudent(peopleFormBody("student", settings.data!.studentFields, form) as CreateStudentBody);
      if (created.credentials) {
        setCredentials([{ label: `${created.firstName} ${created.lastName} · ${created.admissionNumber}`, email: created.credentials.email, password: created.credentials.temporaryPassword }]);
      }
      setShowForm(false);
      setForm({});
      students.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not enrol this student.");
    } finally {
      setSaving(false);
    }
  };

  const open = async (student: StudentRecord) => {
    setSelected(student);
    setSummary(null);
    try {
      setSummary(await getStudentSummary(student.id));
    } catch {
      /* summary is optional */
    }
  };

  const act = async (message: string, action: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await action();
      setNotice(message);
      students.reload();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That did not work. Please try again.");
    }
  };

  return (
    <AppShell allow={["owner", "admin", "teacher"]}>
      <PageHeader
        eyebrow="People"
        title="Students"
        description={canManage ? "Enrol students, manage their sign-in accounts and follow their progress." : "Students in the classes you teach."}
        actions={
          canManage && (
            <>
              <PeopleImport kind="student" fields={settings.data?.studentFields ?? []} disabled={!settings.data} onSaved={students.reload} />
              <Button disabled={!settings.data || !classes.data} onClick={() => { setForm({ classId: classes.data?.[0]?.id ?? "" }); setFormError(null); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Enrol student
              </Button>
            </>
          )
        }
      />

      {settings.error && <Alert tone="error">Could not load school fields: {settings.error}</Alert>}
      {notice && <Alert tone="info" className="mb-4">{notice}</Alert>}

      <Panel className="mb-6 border-slate-200/80 bg-white/90 shadow-subtle backdrop-blur-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or admission number..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Class">
            <option value="">All classes</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="active">Active students</option>
            <option value="suspended">Suspended</option>
            <option value="transferred">Transferred</option>
            <option value="graduated">Graduated</option>
            <option value="">All statuses</option>
          </Select>
        </div>
      </Panel>

      {students.loading ? (
        <LoadingSkeleton count={5} />
      ) : students.error || !students.data ? (
        <ErrorState message={students.error ?? undefined} onRetry={students.reload} />
      ) : students.data.length === 0 ? (
        <EmptyState title="No students found" description="Adjust the filters, or enrol a student to get started." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-subtle transition-all">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Student Scholar</th>
                <th className="hidden px-5 py-3.5 md:table-cell">Admission no.</th>
                <th className="px-5 py-3.5">Class & Arm</th>
                <th className="hidden px-5 py-3.5 lg:table-cell">Guardian Contact</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.data.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => open(student)}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${student.firstName} ${student.lastName}`} src={student.photoUrl} size={36} />
                      <div>
                        <span className="font-semibold text-slate-900 group-hover:text-brand transition-colors">
                          {student.firstName} {student.lastName}
                        </span>
                        <p className="text-[11px] text-slate-400 capitalize md:hidden">{student.admissionNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md">
                      {student.admissionNumber}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-slate-700">{student.classLabel}</span>
                  </td>
                  <td className="hidden px-5 py-3.5 text-slate-500 lg:table-cell">
                    {student.guardianName ? (
                      <span className="truncate block max-w-xs">{student.guardianName}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Badge variant={student.enrollmentStatus === "active" ? "success" : "secondary"}>
                        {student.enrollmentStatus}
                      </Badge>
                      {!student.hasLogin && <Badge variant="outline" className="text-[10px]">no login</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog isOpen={showForm} onClose={() => setShowForm(false)} title="Enrol a student" description="An admission number and a sign-in account are generated automatically." maxWidth="xl">
        <form onSubmit={enroll} className="space-y-4">
          <PeopleFormFields fields={settings.data?.studentFields ?? []} values={form} onChange={setForm} classes={classes.data ?? []} />
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" isLoading={saving}>Enrol student</Button>
          </div>
        </form>
      </Dialog>

      <CredentialsDialog rows={credentials} onClose={() => setCredentials(null)} />

      <Dialog isOpen={selected !== null} onClose={() => setSelected(null)} title={selected ? `${selected.firstName} ${selected.lastName}` : ""} description={selected ? `${selected.classLabel} · ${selected.admissionNumber}` : ""} maxWidth="xl">
        {selected && (
          <div className="space-y-5">
            {selected.customFields && Object.keys(selected.customFields).length > 0 && <dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries(selected.customFields).map(([key, value]) => <div key={key}><dt className="text-slate-500">{settings.data?.studentFields?.find((f) => f.key === key)?.label ?? key}</dt><dd>{String(value)}</dd></div>)}</dl>}

            <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <Avatar name={`${selected.firstName} ${selected.lastName}`} src={selected.photoUrl} size={60} />
              <div className="space-y-0.5 text-sm text-slate-600">
                <p>{selected.loginEmail ? <>Sign-in Account: <span className="font-mono font-medium text-slate-900">{selected.loginEmail}</span></> : <span className="text-slate-400 italic">No sign-in account created yet</span>}</p>
                <p>Guardian: <span className="font-semibold text-slate-800">{selected.guardianName ?? "—"}</span> {selected.guardianPhone ? <span className="text-slate-500">· {selected.guardianPhone}</span> : ""}</p>
              </div>
            </div>

            {summary ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50 p-3.5 shadow-2xs">
                  <p className="font-heading text-2xl font-black text-slate-900">{summary.attendance.attendancePercentage}%</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50 p-3.5 shadow-2xs">
                  <p className="font-heading text-2xl font-black text-slate-900">{summary.metrics.averageScore || "—"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Term average</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50 p-3.5 shadow-2xs">
                  <p className="font-heading text-2xl font-black text-slate-900">{summary.metrics.subjectsGraded}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Graded subjects</p>
                </div>
              </div>
            ) : (
              <LoadingSkeleton count={1} />
            )}

            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void act("Photo updated.", () => uploadStudentPhoto(selected.id, f)); }} />
                <Button size="sm" variant="outline" onClick={() => photoInput.current?.click()}><Camera className="mr-1.5 h-3.5 w-3.5" /> Upload photo</Button>
                {selected.hasLogin ? (
                  <Button size="sm" variant="outline" onClick={() => act("Password reset.", async () => { const { temporaryPassword } = await resetStudentPassword(selected.id); setCredentials([{ label: `${selected.firstName} ${selected.lastName}`, email: selected.loginEmail ?? undefined, password: temporaryPassword }]); })}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset password
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => act("Sign-in account created.", async () => { const c = await createStudentPortalAccount(selected.id); setCredentials([{ label: `${selected.firstName} ${selected.lastName}`, email: c.email, password: c.temporaryPassword }]); })}>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Create sign-in account
                  </Button>
                )}
                {selected.enrollmentStatus === "active" ? (
                  <Button size="sm" variant="outline" onClick={() => act("Student suspended.", () => updateStudentRecord(selected.id, { enrollmentStatus: "suspended" }))}>Suspend</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => act("Student re-activated.", () => updateStudentRecord(selected.id, { enrollmentStatus: "active" }))}>Re-activate</Button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
