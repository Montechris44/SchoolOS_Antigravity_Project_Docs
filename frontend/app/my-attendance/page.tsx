"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { PageHeader, Panel, StatCard, statusTone, formatStatus, useLoader } from "@/components/ui/portal";
import { ClockWidget } from "@/components/dashboards/shared";
import { getMyStaffMonth, getMyStaffStatus } from "@/lib/api/portal-daily";
import { CalendarCheck, Clock, Percent, UserX } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function MyStaffAttendancePage() {
  const status = useLoader(getMyStaffStatus, []);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const history = useLoader(() => getMyStaffMonth(month), [month, status.data?.record?.signInTime, status.data?.record?.signOutTime]);

  return (
    <AppShell allow={["owner", "admin", "teacher", "bursar", "non_academic"]}>
      <PageHeader eyebrow="Attendance" title="My Attendance" description="Sign in when you arrive and sign out when you leave. The school administrator opens attendance each day." />

      {status.loading ? <LoadingSkeleton count={2} /> : status.error || !status.data ? <ErrorState message={status.error ?? undefined} onRetry={status.reload} /> : (
        <ClockWidget status={status.data} onChange={(next) => status.setData(next)} />
      )}

      <div className="mt-6 max-w-xs">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {history.data && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Attendance rate" value={`${history.data.summary.attendanceRate}%`} icon={Percent} tone="emerald" />
            <StatCard label="On time" value={history.data.summary.onTime} icon={CalendarCheck} />
            <StatCard label="Late" value={history.data.summary.late + history.data.summary.veryLate} icon={Clock} tone="amber" />
            <StatCard label="Absent" value={history.data.summary.absent} icon={UserX} tone="rose" />
          </div>
          <Panel title="Days">
            {history.data.records.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No days recorded this month.</p> : (
              <ul className="divide-y divide-slate-100">
                {history.data.records.map((r) => (
                  <li key={r.date} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium">{formatDate(r.date)}</span>
                    <span className="flex items-center gap-3 text-slate-500">
                      {r.signInTime ?? "—"} → {r.signOutTime ?? "—"}
                      <Badge variant={statusTone(r.status)}>{formatStatus(r.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
