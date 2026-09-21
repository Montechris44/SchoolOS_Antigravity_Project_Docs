"use client";

import React, { useState } from "react";
import { DoorClosed, DoorOpen } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, formatStatus, statusTone, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { closeStaffSession, getStaffRegister, markStaff, openStaffSession } from "@/lib/api/portal-daily";
import { localToday } from "@/components/portal/days";
import { StaffAttendanceStatus } from "@/types/portal";

const STATUSES: StaffAttendanceStatus[] = ["ON_TIME", "LATE", "VERY_LATE", "ABSENT", "ON_LEAVE"];

export default function StaffAttendancePage() {
  const [date, setDate] = useState(localToday());
  const register = useLoader(() => getStaffRegister(date), [date]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const act = async (text: string, action: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text });
      register.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work." });
    }
  };

  const session = register.data?.session;
  const isToday = date === localToday();

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader
        eyebrow="Attendance"
        title="Staff Attendance"
        description="Open attendance for the day so staff can sign in and out. Late arrivals are marked from the cutoff times in Settings."
        actions={
          isToday && (
            session?.isOpen ? (
              <Button variant="outline" onClick={() => act("Attendance closed for today.", () => closeStaffSession(date))}><DoorClosed className="mr-2 h-4 w-4" /> Close attendance</Button>
            ) : (
              <Button onClick={() => act("Attendance is open. Staff can sign in.", () => openStaffSession(date))}><DoorOpen className="mr-2 h-4 w-4" /> Open attendance</Button>
            )
          )
        }
      />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48"><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {session && <Badge variant={session.isOpen ? "success" : "secondary"}>{session.isOpen ? "Open for sign-in" : "Closed"}</Badge>}
        </div>
      </Panel>

      {register.loading ? <LoadingSkeleton count={5} /> : register.error || !register.data ? <ErrorState message={register.error ?? undefined} onRetry={register.reload} /> : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3">Staff</th><th className="hidden px-5 py-3 md:table-cell">Role</th><th className="px-5 py-3">In</th><th className="px-5 py-3">Out</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Override</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {register.data.records.map((row) => (
                <tr key={row.userId}>
                  <td className="px-5 py-3"><p className="font-semibold text-slate-900">{row.name}</p><p className="font-mono text-[10px] text-slate-400">{row.employeeId}</p></td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">{row.subject ?? row.role}</td>
                  <td className="px-5 py-3">{row.signInTime ?? "—"}</td>
                  <td className="px-5 py-3">{row.signOutTime ?? "—"}</td>
                  <td className="px-5 py-3"><Badge variant={statusTone(row.status)}>{formatStatus(row.status)}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="w-36">
                      <Select aria-label={`Mark ${row.name}`} value="" onChange={(e) => e.target.value && act(`${row.name} marked ${formatStatus(e.target.value).toLowerCase()}.`, () => markStaff({ staffUserId: row.userId, attendanceDate: date, status: e.target.value }))}>
                        <option value="">Mark as…</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                      </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
