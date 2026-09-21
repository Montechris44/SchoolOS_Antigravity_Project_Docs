import React from "react";
import Link from "next/link";
import { CalendarCheck, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Users, text: "One sign-in for administrators, teachers, students and parents" },
  { icon: GraduationCap, text: "Results, report cards and timetables in one place" },
  { icon: CalendarCheck, text: "Attendance and homework, tracked every day" },
  { icon: ShieldCheck, text: "Every school's data is fully isolated and protected" },
];

/** Split-screen frame shared by the sign-in, password-reset and first-login screens. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-12 text-white md:flex md:w-1/2 md:items-center md:justify-center">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />

        <div className="relative z-10 max-w-lg">
          <Link href="/" className="mb-12 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="font-heading text-3xl font-bold tracking-tight">SchoolOS</span>
          </Link>

          <h2 className="font-heading text-4xl font-bold leading-tight">Run your whole school from one calm, connected workspace.</h2>
          <p className="mt-4 text-lg text-blue-100">
            <Sparkles className="mr-1 inline h-5 w-5" />
            Sign in with the account your school gave you. Your role decides what you see.
          </p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-blue-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-heading text-lg font-bold">SchoolOS</span>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
