"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { PageHeader, Panel, StatCard, statusTone, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { getChildAttendance, getMyAttendance, listParentChildren } from "@/lib/api/portal-daily";
import { formatDate } from "@/lib/utils";

function AttendanceView() {
  const { role } = useAuth();
  const isParent = role === "parent";
  const search = useSearchParams();
  const children = useLoader(async () => (isParent ? listParentChildren() : []), [isParent]);
  const [childId, setChildId] = useState(search.get("child") ?? "");
  useEffect(() => {
    if (isParent && !childId && children.data?.[0]) setChildId(children.data[0].id);
  }, [isParent, childId, children.data]);

  const history = useLoader(async () => (isParent ? (childId ? getChildAttendance(childId) : null) : getMyAttendance()), [isParent, childId]);
  const data = history.data;

  return (
    <>
      <PageHeader eyebrow="Attendance" title={isParent ? "Child Attendance" : "My Attendance"} description="Every register your teachers have taken over the last 90 days." />
      {isParent && (
        <Panel className="mb-6">
          <div className="max-w-xs">
            <Select label="Child" value={childId} onChange={(e) => setChildId(e.target.value)}>
              {children.data?.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </Select>
          </div>
        </Panel>
      )}

      {history.loading ? <LoadingSkeleton count={3} /> : history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : !data || data.records.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No attendance recorded yet" description="Registers will appear here once teachers start taking attendance." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Attendance" value={`${data.summary.attendancePct}%`} icon={CalendarCheck} tone="emerald" />
            <StatCard label="Present" value={data.summary.present} icon={CalendarCheck} />
            <StatCard label="Late" value={data.summary.late} icon={CalendarCheck} tone="amber" />
            <StatCard label="Absent" value={data.summary.absent} icon={CalendarCheck} tone="rose" />
          </div>
          <Panel title="Recent days">
            <ul className="divide-y divide-slate-100">
              {data.records.slice(0, 40).map((record) => (
                <li key={record.date} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-slate-800">{formatDate(record.date)}</span>
                  <span className="flex items-center gap-3">
                    {record.notes && <span className="text-xs text-slate-400">{record.notes}</span>}
                    <Badge variant={statusTone(record.status)}>{record.status.toLowerCase()}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}

export default function MyAttendancePage() {
  return (
    <AppShell allow={["student", "parent"]}>
      <Suspense fallback={<LoadingSkeleton count={3} />}>
        <AttendanceView />
      </Suspense>
    </AppShell>
  );
}
