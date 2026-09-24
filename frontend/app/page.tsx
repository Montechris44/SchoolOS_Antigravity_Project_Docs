"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Wallet,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  BookOpen,
  Activity,
  Users,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CORE_MODULES = [
  {
    icon: Wallet,
    title: "Paystack Fee Collection & Auto-Reconciliation",
    badge: "Finance",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    description:
      "Generate digital tuition invoices, collect payments instantly through Paystack via card or bank transfer, and reconcile every kobo automatically without bank statement delays.",
    points: ["Naira fee structures & termly billing", "Instant parent receipt generation", "Real-time debtor aging & payment tracking"],
  },
  {
    icon: Award,
    title: "Authoritative Academics & WAEC Grading",
    badge: "Academics",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80",
    description:
      "Full Continuous Assessment (CA1, CA2) and terminal exam grading tailored to the standard WAEC/NECO scale (A1 to F9) with automated broadsheets and printable report cards.",
    points: ["Automated class position & terminal averages", "Subject teacher review & approval workflows", "Principal remarks & class teacher notes"],
  },
  {
    icon: CalendarCheck,
    title: "Attendance & Staff Daily Clock-In",
    badge: "Operations",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200/80",
    description:
      "Class teachers mark student attendance in 60 seconds with morning cutoff times. Track staff arrival, calculate attendance rates, and spot absenteeism early.",
    points: ["Morning student roll call with lateness tracking", "Staff sign-in & sign-out compliance", "Automated truancy alerts for homeroom teachers"],
  },
  {
    icon: Sparkles,
    title: "AI Action Center & Early Risk Alerts",
    badge: "AI Powered",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200/80",
    description:
      "Deterministic intelligence continuously monitors school health. Get prioritized recommendations on attendance drops, outstanding fees, and academic declines before term end.",
    points: ["Real-time School Health Score (0–100)", "Actionable tasks assigned to key staff members", "Natural-language operational queries grounded in live data"],
  },
];

const ROLES = [
  {
    title: "School Owners & Proprietors",
    description: "Executive visibility across multiple arms, revenue intake, debtor balances, and overall operational health.",
    icon: ShieldCheck,
    tag: "Executive Console",
  },
  {
    title: "Principals & Vice Principals",
    description: "Approve exam results, monitor teacher submission deadlines, inspect class attendance, and oversee broadsheets.",
    icon: GraduationCap,
    tag: "Academic Leadership",
  },
  {
    title: "Bursars & Finance Teams",
    description: "Create fee structures, issue bulk term invoices, verify bank teller payments, and track Paystack settlements.",
    icon: Wallet,
    tag: "Finance & Billing",
  },
  {
    title: "Class & Subject Teachers",
    description: "Submit test scores, mark daily roll call, enter termly remarks, and manage subject homework seamlessly.",
    icon: BookOpen,
    tag: "Classroom Hub",
  },
  {
    title: "Parents & Guardians",
    description: "View published report cards, inspect daily attendance records, and pay term fees safely from any smartphone.",
    icon: Users,
    tag: "Parent Portal",
  },
  {
    title: "Students & Scholars",
    description: "Access weekly timetables, view upcoming homework deadlines, check examination results, and review past reports.",
    icon: Award,
    tag: "Student Portal",
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
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-brand-soft selection:text-brand relative overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 -z-10 h-[640px] w-full max-w-7xl rounded-full bg-gradient-to-b from-blue-100/50 via-sky-50/30 to-transparent blur-3xl" />

      {/* Floating Modern Header */}
      <div className="sticky top-4 z-50 mx-auto max-w-6xl px-4">
        <header className="glass-header flex items-center justify-between rounded-2xl border border-slate-200/80 px-5 py-3 shadow-subtle">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm ring-2 ring-brand/10 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-black tracking-tight text-slate-900">SchoolOS</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Operating System</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#roles" className="hover:text-slate-900 transition-colors">Portals & Roles</a>
            <a href="#preview" className="hover:text-slate-900 transition-colors">Live Preview</a>
            <a href="#nigerian-standards" className="hover:text-slate-900 transition-colors">WAEC & Paystack</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="font-semibold text-slate-700">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="font-semibold shadow-sm hover:shadow-md">
                Register school <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" /> AI-Powered Operating System for Nigerian Schools
        </div>

        <h1 className="mt-8 font-heading text-4xl font-black tracking-tight text-slate-900 sm:text-6xl lg:text-7xl leading-[1.08]">
          Turn daily school activity into{" "}
          <span className="bg-gradient-to-r from-blue-700 via-brand to-indigo-700 bg-clip-text text-transparent">
            confident decisions.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
          SchoolOS unifies academics, daily attendance, Paystack fee billing, report cards, and an AI Action Center
          into one elegant workspace tailored for primary and secondary schools in Nigeria.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold shadow-md hover:shadow-lg">
              Register your school <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold border-slate-300">
              Sign in to workspace
            </Button>
          </Link>
        </div>

        {/* School Trust Banner */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Paystack Online & Offline Billing
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> WAEC/NECO Standard Grading (A1–F9)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Role-Based Access for 6 Portals
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Strict Tenant Data Isolation
          </span>
        </div>

        {/* Live Cockpit Preview Mockup */}
        <div id="preview" className="mt-16 sm:mt-20 text-left">
          <div className="relative mx-auto max-w-5xl rounded-3xl border border-slate-200/90 bg-white shadow-elevated overflow-hidden ring-1 ring-slate-900/5">
            {/* Mock browser chrome bar */}
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-mono font-medium text-slate-400 hidden sm:inline">
                  https://schoolos.ng/dashboard · Management Cockpit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-slate-600">Active Session 2026/2027</span>
              </div>
            </div>

            {/* Mock Dashboard Body */}
            <div className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
              {/* Executive Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      Executive Console
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                      Corona International School
                    </span>
                  </div>
                  <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Welcome back, Principal Olawale
                  </h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Monitoring 1,280 scholars across JSS 1 to SSS 3, attendance, fee collections, and staff compliance.
                  </p>
                </div>

                <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-white/15 pt-3 sm:pt-0 sm:pl-6 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-sky-300">Health Score</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-3xl font-black text-white">92</span>
                      <span className="text-xs text-blue-300 font-semibold">/ 100</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold">● Operational Stability High</span>
                  </div>
                </div>
              </div>

              {/* 4 Core KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle border-l-4 border-l-blue-600">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fee Collections</span>
                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="font-heading text-2xl font-bold text-slate-900 mt-2">₦42,850,000</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-emerald-700">89.5% Collected</span>
                    <span className="text-rose-600 font-medium">₦4.8M due</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: "89%" }} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle border-l-4 border-l-emerald-600">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today&apos;s Attendance</span>
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                      <CalendarCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="font-heading text-2xl font-bold text-slate-900 mt-2">96.4%</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-emerald-700">1,234 Present</span>
                    <span className="text-slate-400">46 absent</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: "96%" }} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle border-l-4 border-l-purple-600">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">WAEC Pass Rate</span>
                    <div className="rounded-xl bg-purple-50 p-2 text-purple-600">
                      <Award className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="font-heading text-2xl font-bold text-slate-900 mt-2">88.2%</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Credit & Above (A1–C6)</span>
                    <span className="font-semibold text-purple-700">Top 5%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: "88%" }} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle border-l-4 border-l-amber-600">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Scholars</span>
                    <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="font-heading text-2xl font-bold text-slate-900 mt-2">1,280 Enrolled</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>18 Active Class Arms</span>
                    <span className="font-semibold text-amber-700">100% Assigned</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: "94%" }} />
                  </div>
                </div>
              </div>

              {/* AI Action Alert Callout */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-soft/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      AI Action Center: 4 students in SSS 2 Gold flagged for fee balance before mid-term examinations.
                    </p>
                    <p className="text-[11px] text-slate-500">Automated WhatsApp & Email notice draft ready for Bursar review.</p>
                  </div>
                </div>
                <Badge variant="default" className="shrink-0 hidden sm:inline-flex">Review Action</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 lg:py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">Integrated Architecture</span>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-black text-slate-900">
            Everything your school needs, engineered into one calm workspace.
          </h2>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            Replace disconnected spreadsheets, separate messaging groups, manual fee registers, and paper report cards.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {CORE_MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="p-7 sm:p-8 hover:shadow-card-hover transition-all duration-200">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-4 ring-brand/5 shadow-2xs">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900">{module.title}</h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">{module.description}</p>
                <div className="mt-6 border-t border-slate-100 pt-5 space-y-2">
                  {module.points.map((pt) => (
                    <div key={pt} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Role-Based Portals */}
      <section id="roles" className="border-t border-slate-200/80 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">Multi-Role Isolation</span>
            <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-black text-slate-900">
              One login URL. Six purpose-built portals.
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Every staff member, parent, and student enters their credentials on the same login page. SchoolOS automatically resolves their role and opens their specialized portal.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.title}
                  className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-subtle hover:bg-white hover:border-slate-300 hover:shadow-card-hover transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand shadow-xs border border-slate-200/60">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200/60">
                      {role.tag}
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-slate-900">{role.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{role.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Built For Nigerian Standards Section */}
      <section id="nigerian-standards" className="border-y border-slate-200/80 bg-slate-50/60 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Native Nigerian Standards</span>
              <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
                Designed specifically for Nigerian education operations.
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Generic international school management software fails to match the Nigerian school calendar, grading frameworks, and payment culture. SchoolOS is built from the ground up to solve this.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Standard 3-Term Session Structure</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Seamless rollover across First, Second, and Third terms with unified annual academic history.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Paystack Online Naira Billing</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Parents can pay tuition via Bank Transfer, USSD, or Card with webhook-backed instant verification.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">WAEC & NECO Grading Systems</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automated computation into A1 (75+), B2, B3, C4, C5, C6, D7, E8, and F9 with customizable grade thresholds.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Class Arm Organization (Gold, Silver, Diamond)</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Native support for classes divided across arms with dedicated homeroom teachers and arm broadsheets.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Registration Card */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-brand via-sky-500 to-indigo-600 opacity-20 blur-xl" />
              <Card className="relative p-8 sm:p-10 border-slate-200/80 shadow-elevated bg-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md mb-6 ring-4 ring-brand/10">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <h3 className="font-heading text-2xl font-black text-slate-900">Ready to transform your school?</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Registering your school takes less than three minutes. Your owner administrator account is generated immediately.
                </p>

                <div className="mt-8 space-y-3">
                  <Link href="/register" className="block w-full">
                    <Button size="lg" className="w-full rounded-2xl shadow-sm hover:shadow-md font-semibold">
                      Register your school today <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </Link>
                  <Link href="/login" className="block w-full text-center">
                    <Button variant="ghost" className="w-full font-semibold text-slate-600">
                      Already have an account? Sign in
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-12 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-8">
          <div className="flex items-center gap-2 font-heading font-bold text-slate-900 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            SchoolOS
          </div>
          <p>© {new Date().getFullYear()} SchoolOS. Built for primary and secondary schools in Nigeria.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-900 font-medium">Portal Sign In</Link>
            <Link href="/register" className="hover:text-slate-900 font-medium">Register School</Link>
            <Link href="/super-admin/login" className="hover:text-slate-900 font-medium">Platform Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
