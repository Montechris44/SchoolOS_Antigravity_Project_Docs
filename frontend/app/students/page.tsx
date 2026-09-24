"use client";

import React, { useRef, useState } from "react";
import { Camera, KeyRound, Plus, Search, Upload, UserCheck } from "lucide-react";
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
import { listPortalClasses } from "@/lib/api/portal-academics";
import {
  CreateStudentBody,
  bulkImportStudents,
  createStudentPortalAccount,
  enrollStudent,
  getStudentSummary,
  listStudentRecords,
  resetStudentPassword,
  updateStudentRecord,
  uploadStudentPhoto,
} from "@/lib/api/portal-people";
import { PortalClass, StudentRecord } from "@/types/portal";

const blank = {
  firstName: "",
  lastName: "",
  gender: "male" as "male" | "female",
  dateOfBirth: "",
  classId: "",
  armId: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianPhone: "",
  guardianEmail: "",
  guardianRelationship: "father" as "father" | "mother" | "guardian" | "other",
};

/** Minimal CSV reader: handles quoted cells and commas inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export default function StudentsPage() {
  const { can } = useAuth();
  const canManage = can("students:manage");
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const [classFilter, setClassFilter] = useState("");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");

  const classes = useLoader(listPortalClasses, []);
  const students = useLoader(() => listStudentRecords({ classId: classFilter || undefined, status: status || undefined, search: search || undefined }), [classFilter, status, search]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{ ok: number; failed: Array<{ index: number; error: string }> } | null>(null);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getStudentSummary>> | null>(null);

  const armsOf = (classId: string): PortalClass["arms"] => classes.data?.find((c) => c.id === classId)?.arms ?? [];

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const guardian = form.guardianFirstName && form.guardianLastName && form.guardianPhone && form.guardianEmail
        ? { firstName: form.guardianFirstName, lastName: form.guardianLastName, relationship: form.guardianRelationship, phone: form.guardianPhone, email: form.guardianEmail }
        : undefined;
      const created = await enrollStudent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        classId: form.classId,
        armId: form.armId || null,
        guardian,
      });
      if (created.credentials) {
        setCredentials([{ label: `${created.firstName} ${created.lastName} · ${created.admissionNumber}`, email: created.credentials.email, password: created.credentials.temporaryPassword }]);
      }
      setShowForm(false);
      setForm(blank);
      students.reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not enrol this student.");
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async (file: File) => {
    setNotice(null);
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setNotice("The file needs a header row and at least one student.");

    const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
    const col = (name: string) => header.indexOf(name);
    const required = ["firstname", "lastname", "gender", "class"];
    const missing = required.filter((name) => col(name) === -1);
    if (missing.length) return setNotice(`Missing columns: ${missing.join(", ")}. Expected: firstName, lastName, gender, class, arm, dateOfBirth, guardianName, guardianPhone, guardianEmail.`);

    const payload: CreateStudentBody[] = [];
    const problems: Array<{ index: number; error: string }> = [];
    rows.slice(1).forEach((row, i) => {
      const get = (name: string) => (col(name) >= 0 ? row[col(name)] ?? "" : "");
      const cls = classes.data?.find((c) => c.name.toLowerCase() === get("class").toLowerCase());
      if (!cls) return problems.push({ index: i, error: `Unknown class "${get("class")}"` });
      const arm = get("arm") ? cls.arms.find((a) => a.name.toLowerCase() === get("arm").toLowerCase()) : undefined;
      if (get("arm") && !arm) return problems.push({ index: i, error: `Unknown arm "${get("arm")}" in ${cls.name}` });
      const gender = get("gender").toLowerCase().startsWith("f") ? "female" : "male";
      const [gFirst, ...gRest] = get("guardianname").split(" ");
      payload.push({
        firstName: get("firstname"),
        lastName: get("lastname"),
        gender,
        classId: cls.id,
        armId: arm?.id ?? null,
        dateOfBirth: get("dateofbirth") || undefined,
        guardian: get("guardianemail") && get("guardianphone")
          ? { firstName: gFirst || "Guardian", lastName: gRest.join(" ") || get("lastname"), relationship: "guardian", phone: get("guardianphone"), email: get("guardianemail") }
          : undefined,
      });
    });

    if (payload.length === 0) return setImportReport({ ok: 0, failed: problems });
    try {
      const result = await bulkImportStudents(payload);
      setImportReport({ ok: result.success.length, failed: [...problems, ...result.failed.map((f) => ({ index: f.index, error: f.error }))] });
      const rowsOut = result.success.filter((s) => s.credentials).map((s) => ({ label: `${s.student.firstName} ${s.student.lastName} · ${s.student.admissionNumber}`, email: s.credentials!.email, password: s.credentials!.temporaryPassword }));
      if (rowsOut.length) setCredentials(rowsOut);
      students.reload();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Import failed.");
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
              <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <Button onClick={() => { setForm({ ...blank, classId: classes.data?.[0]?.id ?? "" }); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Enrol student
              </Button>
            </>
          )
        }
      />

      {notice && <Alert tone="info" className="mb-4">{notice}</Alert>}
      {importReport && (
        <Alert tone={importReport.failed.length ? "warning" : "success"} className="mb-4">
          Imported {importReport.ok} student(s).{importReport.failed.length > 0 && ` ${importReport.failed.length} row(s) skipped: ${importReport.failed.slice(0, 5).map((f) => `row ${f.index + 2} — ${f.error}`).join("; ")}`}
        </Alert>
      )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Last name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "male" | "female" })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
            <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            <Select label="Class" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, armId: "" })}>
              <option value="" disabled>Select class</option>
              {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Arm" value={form.armId} onChange={(e) => setForm({ ...form, armId: e.target.value })} disabled={armsOf(form.classId).length === 0}>
              <option value="">{armsOf(form.classId).length ? "Select arm" : "No arms"}</option>
              {armsOf(form.classId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Guardian Details (Optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="First name" value={form.guardianFirstName} onChange={(e) => setForm({ ...form, guardianFirstName: e.target.value })} />
              <Input label="Last name" value={form.guardianLastName} onChange={(e) => setForm({ ...form, guardianLastName: e.target.value })} />
              <Input label="Phone" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
              <Input label="E-mail" type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} />
              <Select label="Relationship" value={form.guardianRelationship} onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as typeof form.guardianRelationship })}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
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
