"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">SchoolOS</span>
        </Link>

        <Card>
          <CardHeader>
            <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500">Sign in to your school&apos;s workspace.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label="Email address"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="password"
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

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Sign in <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Registering your school for the first time?{" "}
              <Link href="/register" className="font-semibold text-blue-600 hover:underline">
                Create your school account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
