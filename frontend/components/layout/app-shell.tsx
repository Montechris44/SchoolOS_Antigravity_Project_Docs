"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, ShieldAlert } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ROLE_THEME } from "./role-theme";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

interface AppShellProps {
  children: React.ReactNode;
  /** When set, only these roles may see the page; everyone else gets a clear "not available" message. */
  allow?: UserRole[];
}

export function AppShell({ children, allow }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading, mustChangePassword, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/login");
    else if (mustChangePassword) router.replace("/force-change-password");
  }, [isLoading, isAuthenticated, mustChangePassword, router]);

  if (isLoading || !isAuthenticated || mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 font-medium text-slate-500">
          <div className="flex h-14 w-14 animate-float items-center justify-center rounded-2xl bg-brand text-white shadow-press">
            <GraduationCap className="h-7 w-7" />
          </div>
          <p className="font-heading text-lg font-bold text-slate-700">Opening your school workspace…</p>
        </div>
      </div>
    );
  }

  const allowed = !allow || allow.includes(role);
  const theme = ROLE_THEME[role];

  // data-role switches the whole colour palette (see globals.css): each portal looks and feels different.
  return (
    <div data-role={role} className={cn("relative flex min-h-screen text-slate-900 selection:bg-brand-soft selection:text-brand-strong", theme.backdrop)}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div key={pathname} className="mx-auto max-w-7xl animate-rise-in">
            {allowed ? (
              children
            ) : (
              <div className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-card p-8 text-center shadow-card sm:p-10">
                <div className="mb-4 rounded-full bg-gold-soft p-4 text-slate-800 ring-4 ring-gold/30 shadow-2xs">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-900">This page is not available for your role</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">Use the menu to open the tools that are part of your account.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
