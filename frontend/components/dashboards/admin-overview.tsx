"use client";

import React from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Clock, GraduationCap, Layers, Mail, UserPlus, Users } from "lucide-react";
import { getAdminDashboard } from "@/lib/api/portal-daily";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Panel, StatCard, useLoader } from "@/components/ui/portal";
import { formatDate } from "@/lib/utils";
import { QuickActions, UpcomingEvents } from "./shared";

const ACTION_LABELS: Record<string, string> = {
  "student.enrolled": "enrolled a student",
  "staff.created": "added a staff member",
  "results.class_released": "released class results",
  "results.subject_approved": "approved a subject",
  "results.subject_returned_by_admin": "returned a subject for correction",
  "results.class_submitted": "submitted class results",
  "timetable.created": "updated the timetable",
  "academic_session.set_current": "changed the current session",
  "term.set_current": "changed the current term",
  "grading.updated": "updated the grading scale",
  "invoice.issued": "issued an invoice",
};

function describe(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/** School-operations snapshot shown at the top of the management dashboard for owners and administrators. */
export function AdminOverview() {
  const { data, error, loading, reload } = useLoader(getAdminDashboard, []);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load the school overview."} onRetry={reload} />;

  const { stats } = data;
  const attendancePct = stats.attendanceToday.marked > 0 ? Math.round((stats.attendanceToday.present / stats.attendanceToday.marked) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active students" value={stats.students} icon={GraduationCap} href="/students" hint="Enrolled now" />
        <StatCard label="Teachers" value={stats.teachers} icon={Users} tone="emerald" href="/staff" hint={`${stats.staff} staff in total`} />
        <StatCard label="Classes" value={stats.classes} icon={Layers} tone="amber" href="/classes" hint="Manage arms & teachers" />
        <StatCard
          label="Attendance today"
          value={attendancePct === null ? "—" : `${attendancePct}%`}
          icon={CalendarCheck}
          tone="rose"
          href="/attendance/overview"
          hint={`${stats.attendanceToday.present}/${stats.attendanceToday.marked} present · ${stats.staffSignedInToday} staff in`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Panel title="Quick actions">
            <QuickActions
              actions={[
                { label: "Add student", href: "/students", icon: UserPlus },
                { label: "Attendance", href: "/attendance/overview", icon: CalendarCheck },
                { label: "Approve results", href: "/results/approvals", icon: CheckCircle2 },
                { label: "Messages", href: "/messages", icon: Mail },
              ]}
            />
          </Panel>
          {(stats.results.pendingReview > 0 || stats.results.returned > 0) && (
            <Link
              href="/results/approvals"
              className="block rounded-3xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <Clock className="h-4 w-4" /> Results waiting for you
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {stats.results.pendingReview} subject{stats.results.pendingReview === 1 ? "" : "s"} pending review
                {stats.results.returned > 0 ? `, ${stats.results.returned} returned to teachers` : ""}.
              </p>
            </Link>
          )}
        </div>

        <Panel title="Recent activity" className="lg:col-span-2">
          {data.recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Activity will appear here as your team uses SchoolOS.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <Clock className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    <span className="font-bold text-slate-900">{entry.actorName ?? "System"}</span> {describe(entry.action)}
                  </p>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400">{formatDate(entry.createdAt)}</span>
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
