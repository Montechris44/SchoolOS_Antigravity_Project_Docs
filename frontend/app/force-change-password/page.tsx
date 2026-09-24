"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/portal";
import { AuthShell } from "@/components/auth/auth-shell";
import { homeRouteFor } from "@/components/layout/nav-config";

function passwordProblem(value: string): string | null {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Include at least one letter and one number.";
  return null;
}

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, mustChangePassword, forceUpdatePassword, logout, role, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/login");
    else if (!mustChangePassword) router.replace(homeRouteFor(role));
  }, [isLoading, isAuthenticated, mustChangePassword, role, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("The two passwords do not match.");

    setSaving(true);
    try {
      await forceUpdatePassword(password);
      router.replace(homeRouteFor(role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title="Choose your own password"
      subtitle={`Hi ${user?.fullName ?? "there"} — your account was created with a temporary password. Set a new one to continue.`}
      footer={
        <button onClick={logout} className="font-semibold text-brand hover:underline cursor-pointer">
          Sign out instead
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input id="new-password" label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input id="confirm-password" label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <p className="text-xs text-slate-500">At least 8 characters, with a letter and a number.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full rounded-2xl shadow-sm hover:shadow-md font-semibold" isLoading={saving}>
          <KeyRound className="mr-2 h-4 w-4" /> Save password and continue
        </Button>
      </form>
    </AuthShell>
  );
}
