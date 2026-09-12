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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">SchoolOS Platform Admin</span>
        </div>

        <Card className="border-t-4 border-t-indigo-600">
          <CardHeader>
            <h1 className="text-xl font-bold text-slate-900">Super admin sign in</h1>
            <p className="text-sm text-slate-500">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="superAdminPassword"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 border border-rose-200">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" isLoading={isSubmitting}>
                Sign in <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
