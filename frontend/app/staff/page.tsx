"use client";

import React, { useState } from "react";
import { CalendarClock, KeyRound, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, Avatar, PageHeader, Panel, useLoader } from "@/components/ui/portal";
import { CredentialsDialog, CredentialRow } from "@/components/portal/credentials-dialog";
import { ApiError } from "@/lib/api/client";
import { CreateStaffBody, createStaffMember, deleteStaffMember, getStaffSchedule, listStaffMembers, resetStaffPassword, toggleStaffMember, updateStaffMember } from "@/lib/api/portal-people";
import { StaffMember } from "@/types/portal";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth/types";
import { UserRole } from "@/types";
import { DAYS } from "@/components/portal/days";

const ROLES: Array<{ value: CreateStaffBody["role"]; label: string }> = [
  { value: "teacher", label: "Teacher" },
  { value: "bursar", label: "Bursar / Accountant" },
  { value: "non_academic", label: "Support staff" },
  { value: "admin", label: "School admin" },
];

const blank: CreateStaffBody = { firstName: "", lastName: "", email: "", phone: "", role: "teacher", title: "", gender: undefined, qualification: "", department: "" };

export default function StaffPage() {
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useLoader(() => listStaffMembers({ role: role === "all" ? undefined : role, search: search || undefined }), [role, search]);

  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateStaffBody>(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Awaited<ReturnType<typeof getStaffSchedule>> | null>(null);

  const open = (member: StaffMember | null) => {
    setFormError(null);
    setEditing(member);
    setCreating(member === null);
    setForm(
      member
        ? {
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            phone: member.phone,
            role: member.role as CreateStaffBody["role"],
            title: member.title,
            qualification: member.qualification ?? "",
            department: member.department ?? "",
          }
        : blank
    );
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body = { ...form, phone: form.phone || undefined, title: form.title || undefined, qualification: form.qualification || undefined, department: form.department || undefined };
      if (editing) {
        await updateStaffMember(editing.userId, body);
        setNotice("Staff details updated.");
      } else {
        const created = await createStaffMember(body);
        if (created.temporaryPassword) {
          setCredentials([{ label: `${created.firstName} ${created.lastName} (${ROLE_LABELS[created.role as UserRole] ?? created.role})`, email: created.email, password: created.temporaryPassword }]);
        }
      }
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this staff member.");
    } finally {
      setSaving(false);
    }
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await action();
      setNotice(label);
      reload();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "That did not work. Please try again.");
    }
  };

  const showSchedule = async (member: StaffMember) => {
    try {
      setSchedule(await getStaffSchedule(member.userId));
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not load the schedule.");
    }
  };

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader
        eyebrow="People"
        title="Staff"
        description="Teachers, bursars and support staff. New accounts get a temporary password they must change on first sign-in."
        actions={
          <Button onClick={() => open(null)}>
            <Plus className="mr-2 h-4 w-4" /> Add staff
          </Button>
        }
      />

      {notice && <Alert tone="info" className="mb-4">{notice}</Alert>}

      <Panel className="mb-6 border-slate-200/80 bg-white/90 shadow-subtle backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by staff name, e-mail or employee ID..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <div className="md:w-56">
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
              <option value="all">All staff roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Panel>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : error || !data ? (
        <ErrorState message={error ?? undefined} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No staff yet" description="Add your first teacher or staff member to get started." actionLabel="Add staff" onAction={() => open(null)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((member) => (
            <Panel key={member.id} className="group relative overflow-hidden !p-5 transition-all hover:shadow-card-hover border-slate-200/80 hover:border-brand/40">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-brand-strong opacity-80" />
              <div className="flex items-start gap-3">
                <Avatar name={`${member.firstName} ${member.lastName}`} size={46} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-heading font-bold text-slate-900 group-hover:text-brand transition-colors">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="default">{ROLE_LABELS[member.role as UserRole] ?? member.role}</Badge>
                    <Badge variant={member.isActive ? "success" : "secondary"}>{member.isActive ? "Active" : "Inactive"}</Badge>
                    {member.forcePasswordChange && <Badge variant="warning">Awaiting sign-in</Badge>}
                  </div>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-50/60 p-3 text-xs text-slate-500 border border-slate-100">
                <div className="flex justify-between items-center"><dt>Staff ID</dt><dd className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200/60">{member.employeeId}</dd></div>
                {member.subjects.length > 0 && <div className="flex justify-between gap-4"><dt>Subjects</dt><dd className="truncate font-medium text-slate-700">{member.subjects.join(", ")}</dd></div>}
                {member.classTeacherClassName && (
                  <div className="flex justify-between"><dt>Class teacher</dt><dd className="font-semibold text-brand">{member.classTeacherClassName}{member.classTeacherArmName ? ` ${member.classTeacherArmName}` : ""}</dd></div>
                )}
                <div className="flex justify-between"><dt>Last sign-in</dt><dd className="text-slate-600">{member.lastLoginAt ? formatDate(member.lastLoginAt) : "Never"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                <Button size="sm" variant="ghost" onClick={() => open(member)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                {member.role === "teacher" && <Button size="sm" variant="ghost" onClick={() => showSchedule(member)}><CalendarClock className="mr-1 h-3.5 w-3.5" /> Schedule</Button>}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    run("Password reset.", async () => {
                      const { temporaryPassword } = await resetStaffPassword(member.userId);
                      setCredentials([{ label: `${member.firstName} ${member.lastName}`, email: member.email, password: temporaryPassword }]);
                    })
                  }
                >
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(member.isActive ? "Account deactivated." : "Account activated.", () => toggleStaffMember(member.userId))}>
                  <Power className="mr-1 h-3.5 w-3.5" /> {member.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm(`Delete ${member.firstName} ${member.lastName}? This removes their account and cannot be undone.`)) {
                      void run("Staff member deleted.", () => deleteStaffMember(member.userId));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog isOpen={creating || editing !== null} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Edit staff member" : "Add staff member"} maxWidth="xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Last name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <Input label="E-mail (used to sign in)" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CreateStaffBody["role"] })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <Input label={form.role === "non_academic" ? "Job title (required)" : "Job title"} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Qualification" value={form.qualification ?? ""} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
            <Input label="Department" value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          {!editing && <p className="text-xs text-slate-500">A random temporary password is generated and shown once after you save.</p>}
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{editing ? "Save changes" : "Create account"}</Button>
          </div>
        </form>
      </Dialog>

      <CredentialsDialog rows={credentials} onClose={() => setCredentials(null)} />

      <Dialog isOpen={schedule !== null} onClose={() => setSchedule(null)} title={schedule ? `${schedule.staff.firstName} ${schedule.staff.lastName} — schedule` : ""} maxWidth="lg">
        {schedule && (
          <div className="space-y-3">
            <div className="flex gap-4 text-sm text-slate-600">
              {Object.entries(schedule.metrics).map(([key, value]) => (
                <span key={key}><strong className="text-slate-900">{String(value)}</strong> {key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
              ))}
            </div>
            {schedule.entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No timetable entries yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {schedule.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-semibold text-slate-800">{DAYS[entry.dayOfWeek - 1]} · {entry.startTime}–{entry.endTime}</span>
                    <span className="text-slate-500">{entry.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
