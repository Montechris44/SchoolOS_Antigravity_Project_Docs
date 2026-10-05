"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Wallet,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  BookOpen,
  Users,
  Award,
  Pencil,
  Star,
  Backpack,
  School,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

const CORE_MODULES = [
  {
    icon: Wallet,
    title: "Paystack Fee Collection & Auto-Reconciliation",
    badge: "Bursary",
    role: "bursar",
    description:
      "Generate digital tuition invoices, collect payments instantly through Paystack via card or bank transfer, and reconcile every kobo automatically without bank statement delays.",
    points: ["Naira fee structures & termly billing", "Instant parent receipt generation", "Real-time debtor aging & payment tracking"],
  },
  {
    icon: Award,
    title: "Authoritative Academics & WAEC Grading",
    badge: "Staffroom",
    role: "teacher",
    description:
      "Full Continuous Assessment (CA1, CA2) and terminal exam grading tailored to the standard WAEC/NECO scale (A1 to F9) with automated broadsheets and printable report cards.",
    points: ["Automated class position & terminal averages", "Subject teacher review & approval workflows", "Principal remarks & class teacher notes"],
  },
  {
    icon: CalendarCheck,
    title: "Attendance & Staff Daily Clock-In",
    badge: "Registers",
    role: "student",
    description:
      "Class teachers mark student attendance in 60 seconds with morning cutoff times. Track staff arrival, calculate attendance rates, and spot absenteeism early.",
    points: ["Morning student roll call with lateness tracking", "Staff sign-in & sign-out compliance", "Automated truancy alerts for homeroom teachers"],
  },
  {
    icon: Sparkles,
    title: "AI Action Center & Early Risk Alerts",
    badge: "Principal's desk",
    role: "admin",
    description:
      "Deterministic intelligence continuously monitors school health. Get prioritized recommendations on attendance drops, outstanding fees, and academic declines before term end.",
    points: ["Real-time School Health Score (0–100)", "Actionable tasks assigned to key staff members", "Natural-language operational queries grounded in live data"],
  },
];

const ROLES = [
  {
    title: "Principals & Proprietors",
    description: "Approve exam results, watch fee collection, inspect class attendance and oversee the whole school from a green-chalkboard command desk.",
    icon: ShieldCheck,
    tag: "School Office",
    role: "admin",
  },
  {
    title: "Teachers",
    description: "Submit scores, mark the daily register, write termly remarks and set homework — all on a staffroom desk that feels like your notebook.",
    icon: BookOpen,
    tag: "Staffroom",
    role: "teacher",
  },
  {
    title: "Bursars & Support Staff",
    description: "Create fee structures, issue term invoices, verify teller payments and sign in for the day with one tap.",
    icon: Wallet,
    tag: "Bursary & Staff Lounge",
    role: "bursar",
  },
  {
    title: "Students",
    description: "Check the timetable, see homework due, look up results and celebrate progress in a bright, friendly student corner.",
    icon: Backpack,
    tag: "Student Corner",
    role: "student",
  },
  {
    title: "Parents & Guardians",
    description: "Follow every child's report cards, attendance and school fees from your phone, in a calm and caring parents' lounge.",
    icon: Users,
    tag: "Parents' Lounge",
    role: "parent",
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-slate-900 selection:bg-brand-soft selection:text-brand-strong">
      {/* Navigation */}
      <div className="sticky top-3 z-50 mx-auto max-w-6xl px-3 sm:top-4 sm:px-4">
        <header className="glass-header flex items-center justify-between gap-2 rounded-full border-2 border-brand/15 px-3 py-2 shadow-subtle sm:px-5">
          <Link href="/" className="group flex cursor-pointer items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-press-sm transition-transform group-hover:-rotate-6">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-lg font-black tracking-tight text-slate-900">SchoolOS</span>
              <span className="hidden text-[10px] font-black uppercase tracking-widest text-brand sm:block">School Management</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-brand">Features</a>
            <a href="#roles" className="transition-colors hover:text-brand">Portals</a>
            <a href="#nigerian-standards" className="transition-colors hover:text-brand">WAEC &amp; Paystack</a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="font-bold">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="font-bold">
                <span className="hidden sm:inline">Register school</span>
                <span className="sm:hidden">Register</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </header>
      </div>

      {/* Hero */}
      <section className="bg-grid-paper -mt-16 pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="stagger text-center lg:text-left">
            <span className="inline-flex -rotate-1 items-center gap-2 rounded-md bg-gold-soft px-3.5 py-1.5 text-xs font-black uppercase tracking-widest text-slate-800 ring-1 ring-gold/60">
              <Pencil className="h-3.5 w-3.5 text-brand" /> Built for Nigerian primary &amp; secondary schools
            </span>

            <h1 className="mt-6 font-heading text-4xl font-black leading-[1.08] tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-6xl">
              A school that runs as well as it <span className="scribble">teaches.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              SchoolOS brings the register, the report card, the fee book and the staffroom noticeboard into one warm workspace — with a dedicated space for
              principals, teachers, students and parents.
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Register your school <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Sign in to workspace
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs font-bold text-slate-600 lg:justify-start">
              {["Paystack billing", "WAEC/NECO grading (A1–F9)", "6 role-based portals", "Isolated school data"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Report-card style preview */}
          <div className="relative mx-auto w-full max-w-md animate-pop-in [animation-delay:0.3s]" data-role="admin">
            <Star className="absolute -right-3 -top-5 z-10 h-12 w-12 animate-float fill-gold text-gold" />
            <div className="chalkboard relative rounded-2xl border-[8px] border-[#8a6a3d] p-6 text-white shadow-elevated">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-dashed border-gold/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-gold">Terminal Report</span>
                <span className="text-[11px] font-semibold text-white/60">2026/2027 · First Term</span>
              </div>
              <h3 className="mt-4 font-heading text-2xl font-black">Adaeze Okonkwo</h3>
              <p className="text-xs text-white/60">JSS 2 Gold · Position 3rd of 38</p>

              <div className="mt-5 space-y-3">
                {[
                  { s: "Mathematics", v: 88, g: "A1" },
                  { s: "English Language", v: 79, g: "A1" },
                  { s: "Basic Science", v: 71, g: "B2" },
                  { s: "Civic Education", v: 64, g: "B3" },
                ].map((r) => (
                  <div key={r.s}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white/90">{r.s}</span>
                      <span className="font-mono text-gold">
                        {r.v} · {r.g}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-2 origin-left animate-grow rounded-full bg-gold" style={{ width: `${r.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/10 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-slate-900">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-xs leading-snug text-white/85">&ldquo;A diligent and thoughtful pupil. Keep shining!&rdquo; — Class Teacher</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <Reveal className="mx-auto mb-12 max-w-3xl text-center">
          <span className="text-xs font-black uppercase tracking-widest text-brand">Everything in one school bag</span>
          <h2 className="mt-3 font-heading text-3xl font-black text-slate-900 text-balance sm:text-4xl">Replace the spreadsheets, paper registers and WhatsApp chaos.</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">Fees, results, attendance and decisions — connected, so nothing falls between the desks.</p>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2">
          {CORE_MODULES.map((module, idx) => {
            const Icon = module.icon;
            return (
              <Reveal key={module.title} delay={(idx % 2) * 120}>
              <div data-role={module.role} className="h-full group relative overflow-hidden rounded-2xl border border-slate-200 bg-card p-6 shadow-subtle transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:p-8">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-brand" />
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-press-sm transition-transform group-hover:-rotate-6">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-md bg-brand-soft px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-strong">{module.badge}</span>
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900">{module.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{module.description}</p>
                <div className="mt-6 space-y-2 border-t border-dashed border-slate-200 pt-5">
                  {module.points.map((pt) => (
                    <div key={pt} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Portals */}
      <section id="roles" className="bg-ruled border-y-2 border-dashed border-brand/20 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mx-auto mb-12 max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-brand">One login, five different rooms</span>
            <h2 className="mt-3 font-heading text-3xl font-black text-slate-900 text-balance sm:text-4xl">Every role walks into a space made for them.</h2>
            <p className="mt-4 text-base text-slate-600">Everyone signs in on the same page. SchoolOS recognises who they are and opens the right portal — each with its own colours, layout and mood.</p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => {
              const Icon = r.icon;
              return (
                <Reveal key={r.title} delay={(i % 3) * 110}>
                <div
                  data-role={r.role}
                  className={`group relative h-full overflow-hidden rounded-2xl border-2 border-brand/20 bg-card p-6 shadow-subtle transition-all duration-200 hover:-translate-y-1 hover:border-brand hover:shadow-card-hover ${i % 2 ? "sm:rotate-[0.4deg]" : "sm:-rotate-[0.4deg]"} hover:rotate-0`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-soft transition-transform duration-300 group-hover:scale-125" />
                  <div className="relative mb-4 flex items-center justify-between gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-press-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-gold-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-800 ring-1 ring-gold/50">{r.tag}</span>
                  </div>
                  <h3 className="relative font-heading text-lg font-bold text-slate-900">{r.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{r.description}</p>
                </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Nigerian standards + CTA */}
      <section id="nigerian-standards" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-brand">Made for Nigerian classrooms</span>
              <h2 className="mt-3 font-heading text-3xl font-black leading-tight text-slate-900 text-balance sm:text-4xl">Speaks your school&apos;s language — terms, arms and naira.</h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Generic software doesn&apos;t understand the Nigerian school calendar, the A1–F9 scale or how parents pay. SchoolOS was built around them.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { t: "Standard 3-Term Session Structure", d: "Roll smoothly from First to Third Term with a full academic history." },
                  { t: "Paystack Online Naira Billing", d: "Parents pay by transfer, USSD or card with instant, webhook-verified receipts." },
                  { t: "WAEC & NECO Grading Systems", d: "A1 (75+) through F9, with customisable thresholds and automatic positions." },
                  { t: "Class Arms (Gold, Silver, Diamond)", d: "Arms, homeroom teachers and broadsheets handled natively." },
                ].map((item) => (
                  <div key={item.t} className="flex items-start gap-3.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-press-sm">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.t}</h4>
                      <p className="mt-0.5 text-xs text-slate-500">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="chalkboard relative rounded-2xl border-[8px] border-[#8a6a3d] p-7 text-white shadow-elevated sm:p-10">
                <School className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-white/[0.06]" />
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gold text-slate-900 shadow-[0_3px_0_0_rgb(0_0_0/0.3)]">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <h3 className="font-heading text-2xl font-black">Ready for a better term?</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">Registering takes under three minutes, and your owner account is created straight away.</p>

                <div className="mt-8 space-y-3">
                  <Link href="/register" className="block w-full">
                    <Button variant="accent" size="lg" className="w-full">
                      Register your school today <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login" className="block w-full text-center">
                    <Button variant="ghost" className="w-full font-bold text-white hover:bg-white/10 hover:text-white">
                      Already have an account? Sign in
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-500">
        <div className="flex flex-col items-center justify-between gap-4 border-t-2 border-dashed border-slate-200 pt-8 sm:flex-row">
          <div className="flex items-center gap-2 font-heading text-sm font-bold text-slate-900">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            SchoolOS
          </div>
          <p>© {new Date().getFullYear()} SchoolOS. Built for primary and secondary schools in Nigeria.</p>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/login" className="hover:text-brand">Portal Sign In</Link>
            <Link href="/register" className="hover:text-brand">Register School</Link>
            <Link href="/super-admin/login" className="hover:text-brand">Platform Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
