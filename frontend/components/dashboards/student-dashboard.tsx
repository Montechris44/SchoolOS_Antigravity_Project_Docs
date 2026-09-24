"use client";

import React from "react";
import Link from "next/link";
import { Award, CalendarCheck, ClipboardList, Clock, Wallet } from "lucide-react";
import { getStudentDashboard } from "@/lib/api/portal-daily";
import { useAuth } from "@/lib/auth/auth-context";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Panel, StatCard, useLoader } from "@/components/ui/portal";
import { formatCurrency } from "@/lib/utils";
import { Hero, UpcomingEvents } from "./shared";

export function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoader(getStudentDashboard, []);

  if (loading) return <LoadingSkeleton count={4} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load your dashboard."} onRetry={reload} />;

  const { student, latestResult } = data;

  return (
    <div className="space-y-6">
      <Hero
        eyebrow={`${student.className}${student.armName ? ` ${student.armName}` : ""} · ${student.admissionNumber}`}
        title={`Welcome, ${user?.fullName.split(" ")[0] ?? student.firstName}`}
        subtitle={`${data.period.termName ?? "No active term"}${data.period.sessionName ? ` · ${data.period.sessionName}` : ""}`}
      >
        {data.nextClass ? (
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <Clock className="h-5 w-5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Next class</p>
              <p className="text-sm font-bold">
                {data.nextClass.displayTitle} · {data.nextClass.startTime}
                {data.nextClass.room ? ` · ${data.nextClass.room}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/80">{data.today.holiday ? `No classes today — ${data.today.holiday.title}.` : "No more classes today."}</p>
        )}
      </Hero>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Homework to do"
          value={data.assignments.pending}
          icon={ClipboardList}
          href="/assignments"
          tone={data.assignments.overdue > 0 ? "rose" : "brand"}
          hint={data.assignments.overdue > 0 ? `${data.assignments.overdue} overdue` : `${data.assignments.graded} graded`}
        />
        <StatCard label="Attendance" value={data.attendance.total ? `${data.attendance.attendancePct}%` : "—"} icon={CalendarCheck} tone="emerald" href="/attendance/mine" hint={`${data.attendance.absent} days absent`} />
        <StatCard
          label="Latest result"
          value={latestResult?.average != null ? Number(latestResult.average).toFixed(1) : "—"}
          icon={Award}
          tone="amber"
          href="/results/my"
          hint={latestResult ? `${latestResult.position ?? "–"}${latestResult.positionSuffix ? "" : ""} of ${latestResult.classSize ?? "–"} · ${latestResult.termName}` : "Not published yet"}
        />
        <StatCard label="Fees outstanding" value={formatCurrency(data.fees.outstanding)} icon={Wallet} tone={data.fees.outstanding > 0 ? "rose" : "emerald"} href="/my-fees" hint={`${data.fees.invoices} invoice(s)`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Today's timetable" action={<Link href="/timetable" className="text-xs font-semibold text-brand hover:underline cursor-pointer">Full week</Link>}>
          {data.today.schedule.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">{data.today.message ?? "No lessons today."}</p>
          ) : (
            <ul className="space-y-2.5">
              {data.today.schedule.map((lesson) => (
                <li key={lesson.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors">
                  <span className="w-28 shrink-0 font-mono text-xs font-bold text-brand bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                    {lesson.startTime}–{lesson.endTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{lesson.displayTitle}</p>
                    <p className="truncate text-xs text-slate-500 mt-0.5">{[lesson.teacherName, lesson.room ? `Room ${lesson.room}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <UpcomingEvents events={data.upcomingEvents} />
      </div>
    </div>
  );
}
