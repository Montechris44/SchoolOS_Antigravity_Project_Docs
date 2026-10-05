"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, GraduationCap, Heart, LogIn, LogOut, Pencil, Sparkles, Star } from "lucide-react";
import { clockIn, clockOut } from "@/lib/api/portal-daily";
import { ApiError } from "@/lib/api/client";
import { Alert, Panel } from "@/components/ui/portal";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { MyStaffStatus } from "@/types/portal";

export function QuickActions({ actions }: { actions: Array<{ label: string; href: string; icon: React.ElementType }> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="group flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-card p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-brand hover:bg-brand-soft/60 hover:shadow-card-hover active:translate-y-0"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-press-sm transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-heading text-sm font-bold leading-tight text-slate-800 transition-colors group-hover:text-brand-strong">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export function UpcomingEvents({ events }: { events: Array<{ id: string; title: string; startDate: string; location: string | null }> }) {
  return (
    <Panel title="Upcoming events" action={<Link href="/events" className="text-xs font-bold text-brand hover:underline cursor-pointer">View all events</Link>}>
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No upcoming events scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const date = new Date(event.startDate);
            const valid = !Number.isNaN(date.getTime());
            return (
              <li key={event.id} className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-card p-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
                {/* Tear-off calendar leaf */}
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-card text-center shadow-2xs">
                  <span className="w-full bg-brand py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                    {valid ? date.toLocaleString("en-GB", { month: "short" }) : "Date"}
                  </span>
                  <span className="font-heading text-xl font-black leading-tight text-slate-900">{valid ? date.getDate() : <CalendarDays className="h-5 w-5" />}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{event.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {formatDate(event.startDate)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </li>
            );
          })}
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
                "rounded-md px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider border",
                status.session.isOpen
                  ? "bg-green-50 text-green-800 border-green-300"
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
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Button disabled={!status.canClockIn || busy} onClick={() => act(clockIn)} className="font-semibold">
            <LogIn className="mr-1.5 h-4 w-4" /> Sign in
          </Button>
          <Button variant="outline" disabled={!status.canClockOut || busy} onClick={() => act(clockOut)} className="font-semibold">
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
      {error && <Alert tone="error" className="mt-3.5">{error}</Alert>}
    </Panel>
  );
}

export type HeroVariant = "chalkboard" | "notebook" | "ledger" | "playful" | "cozy";

/**
 * The welcome banner at the top of every dashboard. Each portal has its own variant so the
 * principal office, the staffroom, the student corner and the parent lounge never look alike.
 */
export function Hero({ eyebrow, title, subtitle, children, variant = "chalkboard" }: { eyebrow: string; title: string; subtitle?: string; children?: React.ReactNode; variant?: HeroVariant }) {
  if (variant === "notebook") {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-brand/20 bg-card bg-ruled p-6 pl-8 shadow-card sm:p-8 sm:pl-16">
        <div className="pointer-events-none absolute inset-y-0 left-6 w-px bg-rose-300/80 sm:left-12" />
        <div className="pointer-events-none absolute -top-3 right-8 h-8 w-24 rotate-3 rounded-sm bg-gold/60 shadow-2xs" />
        <Pencil className="pointer-events-none absolute -bottom-3 right-6 h-24 w-24 -rotate-12 text-brand/10 sm:h-32 sm:w-32" />
        <div className="relative z-10">
          <span className="inline-flex -rotate-1 items-center gap-2 rounded-md bg-brand px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white shadow-press-sm">{eyebrow}</span>
          <h1 className="mt-3 font-heading text-2xl font-black tracking-tight text-slate-900 text-balance sm:text-3xl lg:text-4xl">
            <span className="scribble">{title}</span>
          </h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p>}
          {children && <div className="relative mt-5">{children}</div>}
        </div>
      </div>
    );
  }

  if (variant === "ledger") {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-brand-strong p-6 text-white shadow-card sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(255_255_255/0.25)_1.2px,transparent_1.2px)] [background-size:18px_18px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-gold" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-gold">{eyebrow}</span>
            <h1 className="mt-2.5 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{subtitle}</p>}
          </div>
          <BookOpen className="hidden h-16 w-16 shrink-0 text-white/20 sm:block" />
        </div>
        {children && <div className="relative z-10 mt-5">{children}</div>}
      </div>
    );
  }

  if (variant === "playful") {
    return (
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-brand to-gold p-6 text-white shadow-press sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/20" />
        <div className="pointer-events-none absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-gold/60" />
        <div className="pointer-events-none absolute left-1/2 top-4 h-6 w-6 rotate-12 rounded-md bg-white/30" />
        <Star className="pointer-events-none absolute right-8 top-8 h-10 w-10 animate-float fill-gold text-gold sm:h-14 sm:w-14" />
        <Sparkles className="pointer-events-none absolute bottom-6 right-6 hidden h-8 w-8 animate-float text-white/80 sm:block" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-brand-strong shadow-[0_2px_0_0_rgb(0_0_0/0.2)]">{eyebrow}</span>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-white/90 sm:text-base">{subtitle}</p>}
          {children && <div className="relative mt-5">{children}</div>}
        </div>
      </div>
    );
  }

  if (variant === "cozy") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-strong via-brand to-gold p-6 text-white shadow-card sm:p-8">
        <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-gold/30 blur-2xl" />
        <Heart className="pointer-events-none absolute right-6 top-6 h-16 w-16 animate-float fill-white/15 text-white/25 sm:h-24 sm:w-24" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">{eyebrow}</span>
          <h1 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-white text-balance sm:text-3xl lg:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">{subtitle}</p>}
          {children && <div className="relative mt-5">{children}</div>}
        </div>
      </div>
    );
  }

  // chalkboard (administrators)
  return (
    <div className="chalkboard relative overflow-hidden rounded-2xl border-[6px] border-[#8a6a3d] p-6 text-white shadow-card sm:p-8">
      <GraduationCap className="pointer-events-none absolute -right-4 -top-4 h-36 w-36 -rotate-12 text-white/[0.06] sm:h-52 sm:w-52" />
      <div className="pointer-events-none absolute inset-x-6 bottom-3 h-1 rounded-full bg-white/15" />
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-md border border-dashed border-gold/60 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-gold">{eyebrow}</span>
        <h1 className="mt-3 font-heading text-2xl font-black tracking-tight text-white text-balance sm:text-3xl lg:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{subtitle}</p>}
        {children && <div className="relative mt-5 pb-3">{children}</div>}
      </div>
    </div>
  );
}
