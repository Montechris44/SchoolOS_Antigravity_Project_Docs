"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, login } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Authentication Required</h2>
          <p className="mt-2 text-sm text-slate-500">
            Please authenticate to access SchoolOS operational workspace.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => login("owner")} className="w-full">
              Sign In as Proprietor (Owner)
            </Button>
            <Button onClick={() => login("teacher")} variant="outline" className="w-full">
              Sign In as Class Teacher
            </Button>
            <Button onClick={() => login("parent")} variant="secondary" className="w-full">
              Sign In as Guardian / Parent
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
