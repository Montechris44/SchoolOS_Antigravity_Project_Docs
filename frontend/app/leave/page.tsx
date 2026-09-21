"use client";

import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, Tabs, Textarea, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { cancelStaffLeave, createLeavePass, listLeavePasses, listMyStaffLeave, listParentChildren, listStaffLeave, requestStaffLeave, reviewLeavePass, reviewStaffLeave } from "@/lib/api/portal-daily";
import { listStudentRecords } from "@/lib/api/portal-people";
import { localToday } from "@/components/portal/days";
import { formatDate } from "@/lib/utils";

type Tab = "passes" | "staff";

export default function LeavePage() {
  const { role, can } = useAuth();
  const isAdmin = can("leave:manage");
  const isStaff = role !== "parent" && role !== "student";
  const canRequestPass = role === "owner" || role === "admin" || role === "teacher" || role === "parent";
  const [tab, setTab] = useState<Tab>(role === "parent" || isAdmin ? "passes" : "staff");

  const passes = useLoader(async () => (role === "student" ? [] : listLeavePasses()), [role]);
  const staffLeave = useLoader(async () => (isAdmin ? listStaffLeave() : isStaff ? listMyStaffLeave() : []), [isAdmin, isStaff]);
  const students = useLoader(async () => (role === "parent" ? (await listParentChildren()).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })) : canRequestPass ? (await listStudentRecords({ status: "active" })).map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName} — ${s.classLabel}` })) : []), [role]);

  const [passForm, setPassForm] = useState<{ studentId: string; reason: string; startDate: string; endDate: string; leaveType: string } | null>(null);
  const [staffForm, setStaffForm] = useState<{ reason: string; startDate: string; endDate: string; leaveType: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const run = async (text: string, action: () => Promise<unknown>, reload: () => void) => {
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text });
      reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work." });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Community"
        title="Leave"
        description="Student leave passes and staff leave requests."
        actions={
          tab === "passes" && canRequestPass ? (
            <Button onClick={() => setPassForm({ studentId: students.data?.[0]?.id ?? "", reason: "", startDate: localToday(), endDate: localToday(), leaveType: "GENERAL" })}><Plus className="mr-2 h-4 w-4" /> Request leave pass</Button>
          ) : tab === "staff" && isStaff && !isAdmin ? (
            <Button onClick={() => setStaffForm({ reason: "", startDate: localToday(), endDate: localToday(), leaveType: "OTHER" })}><Plus className="mr-2 h-4 w-4" /> Request leave</Button>
          ) : undefined
        }
      />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {role !== "student" && (
        <Tabs
          tabs={[
            ...(role === "non_academic" || role === "bursar" ? [] : [{ id: "passes" as Tab, label: "Student passes", count: passes.data?.filter((p) => p.status === "PENDING").length }]),
            ...(isStaff ? [{ id: "staff" as Tab, label: isAdmin ? "Staff requests" : "My leave" }] : []),
          ]}
          active={tab}
          onChange={setTab}
        />
      )}

      {tab === "passes" ? (
        passes.loading ? <LoadingSkeleton count={3} /> : passes.error || !passes.data ? <ErrorState message={passes.error ?? undefined} onRetry={passes.reload} /> : passes.data.length === 0 ? (
          <EmptyState title="No leave passes" description="Requests for students to be excused appear here." />
        ) : (
          <div className="space-y-3">
            {passes.data.map((p) => (
              <Panel key={p.id} className="!p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{p.firstName} {p.lastName} <span className="font-normal text-slate-500">· {p.className}</span></p>
                    <p className="text-sm text-slate-600">{p.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(p.startDate)} – {formatDate(p.endDate)} · requested by {p.requestedByName ?? "—"}</p>
                    {p.rejectionReason && <p className="mt-1 text-xs text-rose-600">Reason: {p.rejectionReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusTone(p.status)}>{formatStatus(p.status)}</Badge>
                    {isAdmin && p.status === "PENDING" && (
                      <>
                        <Button size="sm" onClick={() => run("Leave pass approved.", () => reviewLeavePass(p.id, "APPROVED"), passes.reload)}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setRejecting({ id: p.id, reason: "" })}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )
      ) : staffLeave.loading ? <LoadingSkeleton count={3} /> : staffLeave.error || !staffLeave.data ? <ErrorState message={staffLeave.error ?? undefined} onRetry={staffLeave.reload} /> : staffLeave.data.length === 0 ? (
        <EmptyState title="No leave requests" description={isAdmin ? "Staff requests will appear here." : "Request time off and track its approval here."} />
      ) : (
        <div className="space-y-3">
          {staffLeave.data.map((l) => (
            <Panel key={l.id} className="!p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {isAdmin && <p className="font-bold text-slate-900">{l.staffName}</p>}
                  <p className="text-sm text-slate-600">{l.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(l.startDate)} – {formatDate(l.endDate)}</p>
                  {l.reviewNotes && <p className="mt-1 text-xs text-slate-500">Note: {l.reviewNotes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusTone(l.status)}>{formatStatus(l.status)}</Badge>
                  {isAdmin && l.status === "PENDING" && (
                    <>
                      <Button size="sm" onClick={() => run("Leave approved.", () => reviewStaffLeave(l.id, "APPROVED"), staffLeave.reload)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => run("Leave rejected.", () => reviewStaffLeave(l.id, "REJECTED"), staffLeave.reload)}>Reject</Button>
                    </>
                  )}
                  {!isAdmin && l.status === "PENDING" && <Button size="sm" variant="ghost" onClick={() => run("Request cancelled.", () => cancelStaffLeave(l.id), staffLeave.reload)}>Cancel</Button>}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Dialog isOpen={passForm !== null} onClose={() => setPassForm(null)} title="Request a leave pass">
        {passForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(isAdmin ? "Leave pass issued." : "Request sent for approval.", () => createLeavePass(passForm), passes.reload).then(() => setPassForm(null)); }}>
            <Select label="Student" required value={passForm.studentId} onChange={(e) => setPassForm({ ...passForm, studentId: e.target.value })}>
              <option value="" disabled>Choose a student</option>
              {students.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" required value={passForm.startDate} onChange={(e) => setPassForm({ ...passForm, startDate: e.target.value })} />
              <Input label="To" type="date" required value={passForm.endDate} onChange={(e) => setPassForm({ ...passForm, endDate: e.target.value })} />
            </div>
            <Textarea label="Reason" required minLength={3} value={passForm.reason} onChange={(e) => setPassForm({ ...passForm, reason: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setPassForm(null)}>Cancel</Button><Button type="submit">Submit</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={staffForm !== null} onClose={() => setStaffForm(null)} title="Request leave">
        {staffForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Leave request sent.", () => requestStaffLeave(staffForm), staffLeave.reload).then(() => setStaffForm(null)); }}>
            <Select label="Type" value={staffForm.leaveType} onChange={(e) => setStaffForm({ ...staffForm, leaveType: e.target.value })}>
              {["ANNUAL", "SICK", "MATERNITY", "STUDY", "OTHER"].map((t) => <option key={t}>{t}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" required value={staffForm.startDate} onChange={(e) => setStaffForm({ ...staffForm, startDate: e.target.value })} />
              <Input label="To" type="date" required value={staffForm.endDate} onChange={(e) => setStaffForm({ ...staffForm, endDate: e.target.value })} />
            </div>
            <Textarea label="Reason" required minLength={3} value={staffForm.reason} onChange={(e) => setStaffForm({ ...staffForm, reason: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setStaffForm(null)}>Cancel</Button><Button type="submit">Send request</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={rejecting !== null} onClose={() => setRejecting(null)} title="Reject leave pass">
        {rejecting && (
          <div className="space-y-4">
            <Textarea label="Reason (shown to the requester)" value={rejecting.reason} onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button onClick={() => void run("Leave pass rejected.", () => reviewLeavePass(rejecting.id, "REJECTED", rejecting.reason || undefined), passes.reload).then(() => setRejecting(null))}>Reject</Button></div>
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
