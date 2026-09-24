"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, LogIn, LogOut } from "lucide-react";
import { clockIn, clockOut } from "@/lib/api/portal-daily";
import { ApiError } from "@/lib/api/client";
import { Alert, Panel } from "@/components/ui/portal";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { MyStaffStatus } from "@/types/portal";

export function QuickActions({ actions }: { actions: Array<{ label: string; href: string; icon: React.ElementType }> }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 text-center shadow-subtle transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-card-hover cursor-pointer"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-sm ring-4 ring-brand/10 transition-transform duration-200 group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-heading text-sm font-bold text-slate-800 group-hover:text-brand transition-colors">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export function UpcomingEvents({ events }: { events: Array<{ id: string; title: string; startDate: string; location: string | null }> }) {
  return (
    <Panel title="Upcoming events" action={<Link href="/events" className="text-xs font-semibold text-brand hover:underline cursor-pointer">View all events</Link>}>
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No upcoming events scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-2 ring-brand/10">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDate(event.startDate)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Sign-in / sign-out for staff. Only works while the administrator has today's attendance open. */
export function ClockWidget({ status, onChange }: { status: MyStaffStatus; onChange: (next: MyStaffStatus) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const act = async (fn: () => Promise<MyStaffStatus>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record your attendance.");
    } finally {
      setBusy(false);
    }
  };

  const record = status.record;
  return (
    <Panel title="Today's attendance">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Roll call status:</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border",
                status.session.isOpen
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              )}
            >
              {status.session.isOpen ? "Open" : "Closed"}
            </span>
            <span className="text-xs text-slate-400">· Cutoff: {status.cutoffs.onTime}</span>
          </div>
          {record?.signInTime ? (
            <p className="font-semibold text-slate-800 text-sm">
              In: {record.signInTime}
              {record.signOutTime ? ` · Out: ${record.signOutTime}` : ""} ·{" "}
              <span className="text-brand font-bold capitalize">{record.status.replace("_", " ").toLowerCase()}</span>
            </p>
          ) : (
            <p className="font-medium text-slate-600 text-sm">You have not signed in yet today.</p>
          )}
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button disabled={!status.canClockIn || busy} onClick={() => act(clockIn)} className="rounded-xl font-semibold shadow-2xs">
            <LogIn className="mr-1.5 h-4 w-4" /> Sign in
          </Button>
          <Button variant="outline" disabled={!status.canClockOut || busy} onClick={() => act(clockOut)} className="rounded-xl font-semibold shadow-2xs">
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
      {error && <Alert tone="error" className="mt-3.5">{error}</Alert>}
    </Panel>
  );
}

export function Hero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-7 sm:p-8 text-white shadow-card">
      <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300 border border-white/10">
          {eyebrow}
        </span>
        <h1 className="mt-2.5 font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">{subtitle}</p>}
        {children && <div className="relative mt-6">{children}</div>}
      </div>
    </div>
  );
}
