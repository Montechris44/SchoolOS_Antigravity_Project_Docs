"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  GraduationCap,
  CreditCard,
  Receipt,
  Megaphone,
  Activity,
  CheckSquare,
  Sparkles,
  Settings,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Management Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "admin"],
  },
  {
    label: "Intelligence Engine",
    href: "/intelligence",
    icon: Activity,
    roles: ["owner", "admin", "bursar"],
    badge: "Live",
  },
  {
    label: "Action Center",
    href: "/actions",
    icon: CheckSquare,
    roles: ["owner", "admin", "bursar"],
  },
  {
    label: "People & Classes",
    href: "/people",
    icon: Users,
    roles: ["owner", "admin"],
  },
  {
    label: "Daily Attendance",
    href: "/attendance",
    icon: CalendarCheck,
    roles: ["owner", "admin", "teacher"],
  },
  {
    label: "Academics & Grades",
    href: "/academics",
    icon: GraduationCap,
    roles: ["owner", "admin", "teacher", "parent", "student"],
  },
  {
    label: "Finance & Invoices",
    href: "/finance",
    icon: CreditCard,
    roles: ["owner", "admin", "bursar", "parent"],
  },
  {
    label: "Paystack Payments",
    href: "/payments",
    icon: Receipt,
    roles: ["owner", "admin", "bursar"],
  },
  {
    label: "Communications",
    href: "/communication",
    icon: Megaphone,
    roles: ["owner", "admin", "bursar", "teacher", "parent"],
  },
  {
    label: "AI School Assistant",
    href: "/ai",
    icon: Sparkles,
    roles: ["owner", "admin", "bursar", "teacher"],
    badge: "AI",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["owner", "admin"],
  },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role, school } = useAuth();

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-slate-900 leading-tight truncate">
              {school?.name || "SchoolOS"}
            </span>
            <span className="text-[11px] font-medium tracking-wide text-blue-600 uppercase">
              {school?.state || "Nigeria"}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Navigation Menu
          </div>
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      item.badge === "AI"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* SchoolOS System Badge */}
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 flex items-center justify-between">
            <span className="font-semibold text-slate-700">SchoolOS Enterprise</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
              v1.0 MVP
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
