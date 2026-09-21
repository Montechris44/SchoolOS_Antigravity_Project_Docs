"use client";

import React, { useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, PageHeader, Panel } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_LABELS } from "@/lib/auth/types";
import { ApiError, apiRequest, setStoredRefreshToken, setStoredToken } from "@/lib/api/client";
import { changePassword } from "@/lib/api/auth";

export default function AccountPage() {
  const { user, school, role, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return setNotice({ tone: "error", text: "Use at least 8 characters, including a letter and a number." });
    if (next !== confirm) return setNotice({ tone: "error", text: "The two passwords do not match." });

    setBusy(true);
    try {
      // Changing the password ends every other session and returns a fresh one for this device.
      const session = await changePassword(current, next);
      setStoredToken(session.token);
      setStoredRefreshToken(session.refreshToken);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ tone: "success", text: "Password changed. You have been signed out on your other devices." });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not change your password." });
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async () => {
    await apiRequest("/auth/logout-all", { method: "POST" }).catch(() => undefined);
    logout();
  };

  return (
    <AppShell>
      <PageHeader eyebrow="Account" title="My Account" description="Your profile and sign-in security." />
      <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-semibold">{user?.fullName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-semibold">{user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Role</dt><dd className="font-semibold">{ROLE_LABELS[role]}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">School</dt><dd className="font-semibold">{school?.name}</dd></div>
          </dl>
          <Button variant="outline" className="mt-6" onClick={signOutEverywhere}><LogOut className="mr-2 h-4 w-4" /> Sign out on all devices</Button>
        </Panel>

        <Panel title="Change password">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            <Input label="New password" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            <Button type="submit" isLoading={busy}><KeyRound className="mr-2 h-4 w-4" /> Update password</Button>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> After 5 wrong sign-in attempts an account is locked for 15 minutes.</p>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
