"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight } from "lucide-react";
import * as superAdminApi from "@/lib/api/super-admin";
import { setSuperAdminToken } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await superAdminApi.login(email, password);
      setSuperAdminToken(session.token);
      router.push("/super-admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 flex items-center justify-center gap-2.5 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md ring-4 ring-indigo-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight">SchoolOS Platform</span>
        </div>

        <Card className="rounded-3xl border-slate-200/80 shadow-elevated p-2 sm:p-4">
          <CardHeader>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Platform Security</span>
            <h1 className="font-heading text-2xl font-bold text-slate-900 mt-1">Super admin sign in</h1>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Restricted to platform operators. This is a separate identity from any school account.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="superAdminEmail"
                label="Email address"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@schoolos.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="superAdminPassword"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 border border-rose-200">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm hover:shadow-md" isLoading={isSubmitting}>
                Sign in <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
