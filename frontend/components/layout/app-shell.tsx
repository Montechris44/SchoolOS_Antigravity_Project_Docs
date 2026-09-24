"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@/types";

function shade(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const channel = (index: number) => {
    const raw = parseInt(value.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, Math.round(raw * (1 - amount))))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

interface AppShellProps {
  children: React.ReactNode;
  /** When set, only these roles may see the page; everyone else gets a clear "not available" message. */
  allow?: UserRole[];
}

export function AppShell({ children, allow }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading, mustChangePassword, role, school } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/login");
    else if (mustChangePassword) router.replace("/force-change-password");
  }, [isLoading, isAuthenticated, mustChangePassword, router]);

  // The school's own colour themes the whole workspace.
  const brandStyle = useMemo(() => {
    const color = school?.themeColor;
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
    return { "--brand": color, "--brand-strong": shade(color, 0.15), "--brand-soft": `${color}1a` } as React.CSSProperties;
  }, [school?.themeColor]);

  if (isLoading || !isAuthenticated || mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 font-medium text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Loading SchoolOS workspace...
        </div>
      </div>
    );
  }

  const allowed = !allow || allow.includes(role);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 relative selection:bg-brand-soft selection:text-brand" style={brandStyle}>
      <div className="pointer-events-none fixed top-0 right-1/4 -z-10 h-[480px] w-[480px] rounded-full bg-brand-soft/40 blur-3xl" />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {allowed ? (
              children
            ) : (
              <div className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-card">
                <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-amber-600 ring-4 ring-amber-500/10 shadow-2xs">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-900">This page is not available for your role</h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">Use the menu to open the tools that are part of your account.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
