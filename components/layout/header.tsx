"use client";

import React, { useState } from "react";
import {
  Menu,
  Shield,
  LogOut,
  ChevronDown,
  School as SchoolIcon,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { MOCK_PRIMARY_SCHOOL, MOCK_SECONDARY_SCHOOL } from "@/lib/auth/mock-data";
import { UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";

const ROLES_LIST: { role: UserRole; label: string; desc: string }[] = [
  { role: "owner", label: "Owner / Proprietor", desc: "Full executive oversight & settings" },
  { role: "admin", label: "Principal / Admin", desc: "Daily school operations & academics" },
  { role: "bursar", label: "School Bursar", desc: "Fee structures, invoices, payments" },
  { role: "teacher", label: "Subject / Class Teacher", desc: "Attendance marking & score entry" },
  { role: "parent", label: "Parent / Guardian", desc: "View child results & pay invoices" },
  { role: "student", label: "Enrolled Student", desc: "View personal attendance & reports" },
];

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, school, role, switchRole, switchSchool, logout } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Tenant / School Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setSchoolDropdownOpen(!schoolDropdownOpen);
              setRoleDropdownOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SchoolIcon className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline font-bold">{school?.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {schoolDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Multi-Tenant School Workspaces
              </div>
              {[MOCK_PRIMARY_SCHOOL, MOCK_SECONDARY_SCHOOL].map((sch) => (
                <button
                  key={sch.id}
                  onClick={() => {
                    switchSchool(sch);
                    setSchoolDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{sch.name}</p>
                    <p className="text-[11px] text-slate-400">{sch.city}, {sch.state}</p>
                  </div>
                  {school?.id === sch.id && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Persona Role Switcher for seamless pair testing across all personas */}
        <div className="relative">
          <button
            onClick={() => {
              setRoleDropdownOpen(!roleDropdownOpen);
              setSchoolDropdownOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-all shadow-xs"
          >
            <Shield className="h-3.5 w-3.5 text-blue-700" />
            <span className="font-bold capitalize">{role} Persona</span>
            <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Switch Operational Persona
              </div>
              {ROLES_LIST.map((item) => (
                <button
                  key={item.role}
                  onClick={() => {
                    switchRole(item.role);
                    setRoleDropdownOpen(false);
                  }}
                  className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                  {role === item.role && <Check className="h-4 w-4 text-blue-600 shrink-0 mt-1" />}
                </button>
              ))}
            </div>
          )}
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
