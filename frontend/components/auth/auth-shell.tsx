import React from "react";
import Link from "next/link";
import { CalendarCheck, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Users, text: "One sign-in for administrators, teachers, students and parents" },
  { icon: GraduationCap, text: "Results, report cards and timetables in one place" },
  { icon: CalendarCheck, text: "Attendance and homework, tracked every day" },
  { icon: ShieldCheck, text: "Every school's data is fully isolated and protected" },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-12 lg:p-16 text-white md:flex md:w-1/2 md:items-center md:justify-center">
        {/* Ambient luminous glow accents */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/4 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 max-w-lg">
          <Link href="/" className="mb-12 inline-flex items-center gap-3 group cursor-pointer">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-md ring-4 ring-white/10 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-2xl font-black tracking-tight text-white">SchoolOS</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Nigeria Academic Platform</span>
            </div>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-sky-200 backdrop-blur-md mb-6 border border-white/10">
            <Sparkles className="h-3.5 w-3.5 text-sky-300" /> Unified School Management System
          </div>

          <h2 className="font-heading text-3xl lg:text-4xl font-black leading-tight text-white">
            Run your whole school from one calm, connected workspace.
          </h2>
          <p className="mt-4 text-base text-blue-100/90 leading-relaxed">
            One authoritative sign-in for administrators, bursars, teachers, parents, and students.
          </p>

          <div className="mt-10 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5 rounded-2xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sky-200">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-medium text-blue-50 leading-snug">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3 border-t border-white/10 pt-6">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-blue-200">
              Trusted by leading secondary and primary schools across Nigeria
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50/50 px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-md bg-white p-7 sm:p-10 rounded-3xl border border-slate-200/80 shadow-subtle sm:shadow-card">
          <Link href="/" className="mb-8 flex items-center gap-2.5 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-black text-slate-900">SchoolOS</span>
          </Link>

          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500 leading-relaxed">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-7 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
