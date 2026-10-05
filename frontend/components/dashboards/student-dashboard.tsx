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
    <div className="stagger space-y-6">
      <Hero
        variant="playful"
        eyebrow={`${student.className}${student.armName ? ` ${student.armName}` : ""} · ${student.admissionNumber}`}
        title={`Welcome, ${user?.fullName.split(" ")[0] ?? student.firstName}`}
        subtitle={`${data.period.termName ?? "No active term"}${data.period.sessionName ? ` · ${data.period.sessionName}` : ""}`}
      >
        {data.nextClass ? (
          <div className="inline-flex max-w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-900 shadow-[0_3px_0_0_rgb(0_0_0/0.18)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Clock className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand">Next class</p>
              <p className="text-sm font-extrabold">
                {data.nextClass.displayTitle} · {data.nextClass.startTime}
                {data.nextClass.room ? ` · ${data.nextClass.room}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/80">{data.today.holiday ? `No classes today — ${data.today.holiday.title}.` : "No more classes today."}</p>
        )}
      </Hero>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Panel title="Today's timetable" action={<Link href="/timetable" className="text-xs font-bold text-brand hover:underline cursor-pointer">Full week</Link>}>
          {data.today.schedule.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">{data.today.message ?? "No lessons today."}</p>
          ) : (
            <ul className="space-y-3">
              {data.today.schedule.map((lesson) => (
                <li key={lesson.id} className="flex flex-col gap-2 rounded-2xl border-2 border-gold/50 bg-gold-soft/60 p-3.5 transition-transform hover:-rotate-1 hover:scale-[1.01] sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-fit shrink-0 rounded-full bg-brand px-3 py-1 text-center font-mono text-xs font-bold text-white sm:w-28">
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
