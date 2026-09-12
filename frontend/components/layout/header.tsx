"use client";

import React from "react";
import { Menu, Shield, LogOut, School as SchoolIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, school, role, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
          <SchoolIcon className="h-4 w-4 text-blue-600" />
          <span className="hidden sm:inline font-bold">{school?.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-xs">
          <Shield className="h-3.5 w-3.5 text-blue-700" />
          <span className="font-bold capitalize">{role}</span>
        </div>

        {/* User Card */}
        <div className="hidden sm:flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs shadow-xs">
            {user?.fullName.slice(0, 2).toUpperCase() || "SO"}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {user?.fullName}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {user?.email}
            </span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          title="Sign out"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
