"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/portal";
import { AuthShell } from "@/components/auth/auth-shell";
import { homeRouteFor } from "@/components/layout/nav-config";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await login(email.trim(), password);
      // Accounts issued with a temporary password must choose their own before anything else.
      router.push(session.mustChangePassword ? "/force-change-password" : homeRouteFor(session.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your school's workspace. Administrators, teachers, students and parents all use this page."
      footer={
        <>
          Registering your school for the first time?{" "}
          <Link href="/register" className="font-semibold text-blue-600 hover:underline">
            Create your school account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              placeholder="name@school.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-12 text-sm font-medium outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" size="lg" className="w-full rounded-xl" isLoading={isSubmitting}>
          Sign in <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
