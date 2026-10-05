"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarCheck, ClipboardList, FileEdit, GraduationCap, Mail, Users } from "lucide-react";
import { getTeacherDashboard } from "@/lib/api/portal-daily";
import { useAuth } from "@/lib/auth/auth-context";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Badge } from "@/components/ui/badge";
import { Panel, StatCard, useLoader, formatStatus } from "@/components/ui/portal";
import { ClockWidget, Hero, QuickActions, UpcomingEvents } from "./shared";

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload, setData } = useLoader(getTeacherDashboard, []);

  if (loading) return <LoadingSkeleton count={4} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load your dashboard."} onRetry={reload} />;

  return (
    <div className="stagger space-y-6">
      <Hero
        variant="notebook"
        eyebrow="Teacher workspace"
        title={`Good day, ${user?.fullName.split(" ")[0] ?? "teacher"}`}
        subtitle={`${data.period.termName ?? "No active term"}${data.period.sessionName ? ` · ${data.period.sessionName}` : ""}${
          data.homeroom ? ` · Class teacher of ${data.homeroom.className}${data.homeroom.armName ? ` ${data.homeroom.armName}` : ""}` : ""
        }`}
      />

      <ClockWidget status={data.staffAttendance} onChange={(next) => setData({ ...data, staffAttendance: next })} />

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My classes" value={data.stats.classes} icon={Users} href="/results/entry" hint="Class & arm groups" />
        <StatCard label="Subjects" value={data.stats.subjects} icon={BookOpen} tone="emerald" hint="I teach" />
        <StatCard label="Students" value={data.stats.students} icon={GraduationCap} tone="amber" href="/attendance" hint="Across my classes" />
        <StatCard label="Unread messages" value={data.unread.messages} icon={Mail} tone="violet" href="/messages" hint={`${data.unread.notifications} notifications`} />
      </div>

      {data.needsAttention.length > 0 && (
        <Panel title="Needs your attention">
          <ul className="space-y-3">
            {data.needsAttention.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-xl border-l-4 border-l-brand border border-brand/20 bg-brand-soft/50 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brand-strong">
                    {item.subjectName} · {item.className}
                    {item.armName ? ` ${item.armName}` : ""}
                  </p>
                  {item.reviewNotes && <p className="mt-0.5 text-sm text-slate-700">{item.reviewNotes}</p>}
                </div>
                <Badge variant="warning">{formatStatus(item.status)}</Badge>
              </li>
            ))}
          </ul>
          <Link href="/results/entry" className="mt-4 inline-block text-sm font-bold text-brand hover:underline">
            Open results entry
          </Link>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Panel title="Quick actions">
            <QuickActions
              actions={[
                { label: "Take attendance", href: "/attendance", icon: CalendarCheck },
                { label: "Enter results", href: "/results/entry", icon: FileEdit },
                { label: "Set homework", href: "/assignments", icon: ClipboardList },
                { label: "Class teacher", href: "/results/class-teacher", icon: Users },
              ]}
            />
          </Panel>
        </div>

        <Panel title="Today's lessons" className="lg:col-span-2" action={<Link href="/timetable" className="text-xs font-bold text-brand hover:underline cursor-pointer">Full timetable</Link>}>
          {data.todaySchedule.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No lessons scheduled for today.</p>
          ) : (
            <ul className="relative space-y-3 before:absolute before:bottom-3 before:left-[0.55rem] before:top-3 before:w-0.5 before:bg-brand/20 sm:before:left-[0.6rem]">
              {data.todaySchedule.map((lesson) => (
                <li key={lesson.id} className="relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-card p-3.5 pl-8 transition-colors hover:border-brand/40 hover:bg-brand-soft/30 sm:flex-row sm:items-center sm:gap-4 sm:pl-9">
                  <span className="absolute left-1 top-5 h-3.5 w-3.5 rounded-full border-[3px] border-card bg-brand ring-2 ring-brand/30 sm:left-1.5" />
                  <div className="w-fit shrink-0 rounded-md bg-brand px-2.5 py-1 text-center font-mono text-xs font-bold text-white sm:w-28">
                    {lesson.startTime}–{lesson.endTime}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{lesson.displayTitle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lesson.className}
                      {lesson.armName ? ` ${lesson.armName}` : ""}
                      {lesson.room ? ` · Room ${lesson.room}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <UpcomingEvents events={data.upcomingEvents} />
    </div>
  );
}
