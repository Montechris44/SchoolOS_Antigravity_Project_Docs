"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/portal";
import { AuthShell } from "@/components/auth/auth-shell";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError("Use at least 8 characters, including a letter and a number.");
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset your password. Request a new link and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <Alert tone="error">This reset link is incomplete. Request a new one from the sign-in page.</Alert>;
  if (done) return <Alert tone="success">Password updated. Taking you to the sign-in page…</Alert>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input id="new-password" label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input id="confirm-password" label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full rounded-xl" isLoading={loading}>
        <KeyRound className="mr-2 h-4 w-4" /> Reset password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
