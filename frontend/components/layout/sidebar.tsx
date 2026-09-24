"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { NAV_BY_ROLE } from "./nav-config";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role, school } = useAuth();

  const sections = NAV_BY_ROLE[role] ?? [];
  // The most specific matching item wins, so "/attendance/overview" does not also light up "/attendance".
  const allHrefs = sections.flatMap((section) => section.items.map((item) => item.href));
  const activeHref = allHrefs
    .filter((href) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "no-print fixed top-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200/80 bg-white shadow-subtle transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-18 shrink-0 items-center gap-3 border-b border-slate-100/80 px-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand text-white shadow-sm ring-2 ring-brand/10">
            {school?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logoUrl} alt="" className="h-full w-full object-contain bg-white" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-heading font-bold text-[15px] leading-tight text-slate-900">{school?.name || "SchoolOS"}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate text-[11px] font-semibold text-brand tracking-tight">{school?.state || "Nigeria"}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3.5 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-brand text-white shadow-sm shadow-brand/25 font-semibold"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-4.5 w-4.5 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            isActive ? "bg-white/20 text-white" : item.badge === "AI" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/80 p-3 text-xs text-slate-500 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-800">SchoolOS</span>
            </div>
            <span className="rounded-lg bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">Active</span>
          </div>
        </div>
      </aside>
    </>
  );
}
