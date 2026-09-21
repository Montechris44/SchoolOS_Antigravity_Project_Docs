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
  Bell,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Unified operations",
    description:
      "Attendance, academics, people, and communication in one workspace instead of five disconnected tools.",
  },
  {
    icon: Wallet,
    title: "Finance & Paystack billing",
    description:
      "Generate invoices, track balances, and collect fees online with Paystack — reconciled automatically.",
  },
  {
    icon: Sparkles,
    title: "AI Action Center",
    description:
      "Surfaces attendance drops, overdue fees, and academic decline as concrete actions before they escalate.",
  },
  {
    icon: ShieldCheck,
    title: "Built for multi-tenant schools",
    description:
      "Role-based access for owners, admins, bursars, teachers, parents, and students — each school fully isolated.",
  },
];

const AUDIENCE = [
  "School owners & proprietors",
  "Principals & administrators",
  "Bursars & finance teams",
  "Teachers & class staff",
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
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">SchoolOS</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button>
              Register your school <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-16 text-center lg:px-8 lg:py-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
          <Sparkles className="h-3.5 w-3.5" /> AI-Powered School Operations
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Turn school activity into confident decisions.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          SchoolOS unifies management, academics, attendance, finance, Paystack billing, and an AI Action
          Center for Nigerian schools — so nothing important falls through the cracks.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto">
              Register your school <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Sign in to your workspace
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                One workspace, every role in the school.
              </h2>
              <p className="mt-4 text-slate-600">
                Every membership gets exactly the permissions it needs — nothing more. Owners see everything;
                teachers see their classes; parents see their children.
              </p>
              <ul className="mt-6 space-y-3">
                {AUDIENCE.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Ready to get started?</h3>
              <p className="text-sm text-slate-500">
                Registering your school takes a few minutes and creates your owner account immediately.
              </p>
              <Link href="/register" className="w-full">
                <Button className="w-full">
                  Register your school <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-10 text-center text-xs text-slate-400 lg:px-8">
        © {new Date().getFullYear()}{" "}
        <Link href="/super-admin/login" className="hover:text-slate-500">
          SchoolOS
        </Link>
        . Built for Nigerian schools.
      </footer>
    </div>
  );
}
