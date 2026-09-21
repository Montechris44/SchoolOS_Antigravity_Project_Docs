"use client";

import React, { useState } from "react";
import { CalendarCheck, ChevronDown, Percent, UserX, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { PageHeader, Panel, StatCard, statusTone, useLoader } from "@/components/ui/portal";
import { getAttendanceOverview } from "@/lib/api/portal-daily";
import { listPortalClasses } from "@/lib/api/portal-academics";
import { localToday } from "@/components/portal/days";

export default function AttendanceOverviewPage() {
  const [date, setDate] = useState(localToday());
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const classes = useLoader(listPortalClasses, []);
  const overview = useLoader(() => getAttendanceOverview({ date, classId: classId || undefined }), [date, classId]);

  const data = overview.data;

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader eyebrow="Attendance" title="Attendance Overview" description="Registers taken by teachers, with school-wide rates for the last 30 days." />

      <Panel className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input label="Register date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </Panel>

      {overview.loading ? <LoadingSkeleton count={4} /> : overview.error || !data ? <ErrorState message={overview.error ?? undefined} onRetry={overview.reload} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Overall attendance" value={`${data.metrics.overallAttendancePct}%`} icon={Percent} tone="emerald" hint="Last 30 days" />
            <StatCard label="Absence rate" value={`${data.metrics.avgAbsentRate}%`} icon={UserX} tone="rose" />
            <StatCard label="Classes tracked" value={data.metrics.classesTracked} icon={Users} />
            <StatCard label="Registers taken" value={data.metrics.totalSessions} icon={CalendarCheck} tone="violet" />
          </div>

          <Panel title={`Registers for ${date}`}>
            {data.dailyRecords.length === 0 ? <EmptyState icon={CalendarCheck} title="No register taken" description="No teacher has recorded attendance for this date yet." /> : (
              <ul className="space-y-3">
                {data.dailyRecords.map((record) => {
                  const key = `${record.classId}-${record.armName ?? ""}`;
                  const pct = record.total ? Math.round(((record.present + record.late) / record.total) * 100) : 0;
                  return (
                    <li key={key} className="overflow-hidden rounded-2xl border border-slate-200">
                      <button onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50">
                        <div>
                          <p className="font-bold text-slate-900">{record.className}{record.armName ? ` ${record.armName}` : ""}</p>
                          <p className="text-xs text-slate-500">Recorded by {record.recordedBy ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-emerald-600">{record.present} present</span>
                          {record.late > 0 && <span className="text-amber-600">{record.late} late</span>}
                          <span className="text-rose-600">{record.absent} absent</span>
                          <Badge variant={pct >= 90 ? "success" : pct >= 75 ? "warning" : "destructive"}>{pct}%</Badge>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open === key ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                      {open === key && (
                        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50 px-4">
                          {record.students.map((student) => (
                            <li key={student.id} className="flex items-center justify-between py-2 text-sm">
                              <span className="font-medium text-slate-800">{student.name} <span className="font-mono text-[10px] text-slate-400">{student.admissionNumber}</span></span>
                              <span className="flex items-center gap-2">
                                {student.notes && <span className="text-xs text-slate-400">{student.notes}</span>}
                                <Badge variant={statusTone(student.status)}>{student.status.toLowerCase()}</Badge>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Class summary (last 30 days)">
            {data.classSummary.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No data in this range.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr><th className="pb-2">Class</th><th className="pb-2 text-right">Registers</th><th className="pb-2 text-right">Absent</th><th className="pb-2 text-right">Attendance</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.classSummary.map((row) => (
                    <tr key={row.classId}>
                      <td className="py-2 font-semibold">{row.className}</td>
                      <td className="py-2 text-right">{row.sessions}</td>
                      <td className="py-2 text-right text-rose-600">{row.absent}</td>
                      <td className="py-2 text-right font-bold">{row.attendancePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
