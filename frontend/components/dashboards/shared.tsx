"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, LogIn, LogOut } from "lucide-react";
import { clockIn, clockOut } from "@/lib/api/portal-daily";
import { ApiError } from "@/lib/api/client";
import { Alert, Panel } from "@/components/ui/portal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { MyStaffStatus } from "@/types/portal";

export function QuickActions({ actions }: { actions: Array<{ label: string; href: string; icon: React.ElementType }> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md transition-transform group-hover:rotate-6">
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-sm font-bold text-slate-800">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export function UpcomingEvents({ events }: { events: Array<{ id: string; title: string; startDate: string; location: string | null }> }) {
  return (
    <Panel title="Upcoming events" action={<Link href="/events" className="text-xs font-semibold text-brand hover:underline">View all</Link>}>
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No upcoming events.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{event.title}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(event.startDate)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
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
        <div className="space-y-1 text-sm">
          <p className="text-slate-500">
            Attendance is{" "}
            <span className={status.session.isOpen ? "font-bold text-emerald-600" : "font-bold text-slate-400"}>
              {status.session.isOpen ? "open" : "closed"}
            </span>{" "}
            · on time by {status.cutoffs.onTime}
          </p>
          {record?.signInTime ? (
            <p className="font-semibold text-slate-800">
              In {record.signInTime}
              {record.signOutTime ? ` · Out ${record.signOutTime}` : ""} ·{" "}
              <span className="text-brand">{record.status.replace("_", " ").toLowerCase()}</span>
            </p>
          ) : (
            <p className="font-semibold text-slate-800">You have not signed in yet.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button disabled={!status.canClockIn || busy} onClick={() => act(clockIn)}>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </Button>
          <Button variant="outline" disabled={!status.canClockOut || busy} onClick={() => act(clockOut)}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </Panel>
  );
}

export function Hero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-strong p-6 text-white shadow-lg md:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{eyebrow}</p>
      <h1 className="mt-1 font-heading text-2xl font-bold md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/80">{subtitle}</p>}
      {children && <div className="relative mt-5">{children}</div>}
    </div>
  );
}
