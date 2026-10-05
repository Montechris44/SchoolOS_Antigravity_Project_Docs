import React from "react";
import Link from "next/link";
import { BookOpen, CalendarCheck, GraduationCap, ShieldCheck, Star, Users } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Users, text: "One sign-in for administrators, teachers, students and parents" },
  { icon: GraduationCap, text: "Results, report cards and timetables in one place" },
  { icon: CalendarCheck, text: "Attendance and homework, tracked every day" },
  { icon: ShieldCheck, text: "Every school's data is fully isolated and protected" },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Chalkboard panel */}
      <div className="chalkboard relative hidden overflow-hidden border-r-[10px] border-[#8a6a3d] p-12 text-white lg:flex lg:w-1/2 lg:items-center lg:justify-center xl:p-16">
        <GraduationCap className="pointer-events-none absolute -bottom-10 -right-10 h-96 w-96 -rotate-12 text-white/[0.05]" />
        <BookOpen className="pointer-events-none absolute left-10 top-10 h-16 w-16 rotate-6 text-white/10" />
        <Star className="pointer-events-none absolute right-16 top-16 h-10 w-10 animate-float fill-gold text-gold" />

        <div className="relative z-10 max-w-lg">
          <Link href="/" className="group mb-12 inline-flex cursor-pointer items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-slate-900 shadow-[0_3px_0_0_rgb(0_0_0/0.3)] transition-transform group-hover:-rotate-6">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-2xl font-black tracking-tight text-white">SchoolOS</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-gold">Nigeria Academic Platform</span>
            </div>
          </Link>

          <h2 className="font-heading text-3xl font-black leading-tight text-white xl:text-4xl">
            Where every school day <span className="scribble text-white">comes together.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            One authoritative sign-in for administrators, bursars, teachers, parents, and students.
          </p>

          <div className="mt-9 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5 rounded-xl border border-dashed border-white/20 bg-white/5 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-slate-900">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-sm font-medium leading-snug text-white/90">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-9 flex items-center gap-3 border-t border-dashed border-white/20 pt-6">
            <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-gold" />
            <span className="text-xs font-semibold text-white/70">Trusted by primary and secondary schools across Nigeria</span>
          </div>
        </div>
      </div>

      {/* Form side — exercise-book paper */}
      <div className="bg-ruled flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-10 lg:px-16">
        <div className="relative w-full max-w-md rounded-3xl border-2 border-slate-200 bg-card p-6 shadow-card sm:p-10">
          <div className="pointer-events-none absolute -top-3 left-8 h-6 w-20 -rotate-3 rounded-sm bg-gold/70 shadow-2xs" />
          <Link href="/" className="mb-7 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-press-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-black text-slate-900">SchoolOS</span>
          </Link>

          <h1 className="font-heading text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-7 border-t border-dashed border-slate-200 pt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
