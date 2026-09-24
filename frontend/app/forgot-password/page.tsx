"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/portal";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the e-mail address you sign in with and we will send you a link to choose a new password."
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">If an account exists for {email}, a reset link is on its way. The link works for one hour.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input id="email" label="Email address" type="email" required placeholder="name@school.edu.ng" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full rounded-2xl shadow-sm hover:shadow-md font-semibold" isLoading={loading}>
            <Send className="mr-2 h-4 w-4" /> Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
