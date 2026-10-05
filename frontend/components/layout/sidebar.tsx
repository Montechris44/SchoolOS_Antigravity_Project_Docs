"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, X } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { NAV_BY_ROLE } from "./nav-config";
import { ROLE_THEME, SIDEBAR_CLASSES } from "./role-theme";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role, school } = useAuth();

  const theme = ROLE_THEME[role];
  const look = SIDEBAR_CLASSES[theme.sidebar];
  const sections = NAV_BY_ROLE[role] ?? [];
  // The most specific matching item wins, so "/attendance/overview" does not also light up "/attendance".
  const allHrefs = sections.flatMap((section) => section.items.map((item) => item.href));
  const activeHref = allHrefs
    .filter((href) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  // A school's own colour tints its crest, so each school still feels like itself.
  const crestColor = school?.themeColor && /^#[0-9a-fA-F]{6}$/.test(school.themeColor) ? school.themeColor : undefined;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "no-print fixed top-0 left-0 z-50 flex h-screen w-[17.5rem] max-w-[85vw] flex-col transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0",
          look.aside,
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("relative flex h-18 shrink-0 items-center gap-3 border-b px-5", look.border)}>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold text-slate-900 shadow-[0_2px_0_0_rgb(0_0_0/0.25)] ring-2 ring-white/30"
            style={crestColor && !school?.logoUrl ? { backgroundColor: crestColor, color: "#fff" } : undefined}
          >
            {school?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logoUrl} alt="" className="h-full w-full bg-white object-contain" />
            ) : (
              <GraduationCap className="h-6 w-6" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cn("truncate font-heading text-[15px] font-extrabold leading-tight", look.brandName)}>{school?.name || "SchoolOS"}</span>
            <span className={cn("mt-0.5 truncate text-[10.5px] font-black uppercase tracking-widest", look.brandSub)}>{theme.portalName}</span>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="rounded-full p-1.5 opacity-70 hover:opacity-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <div className={cn("px-3 pb-2 text-[10.5px] font-black uppercase tracking-[0.14em]", look.section)}>{section.title}</div>
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
                        "group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                        isActive ? look.linkActive : look.link
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", isActive ? look.iconActive : look.icon)} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide",
                            item.badge === "AI" ? "bg-violet-100 text-violet-800" : "bg-gold text-slate-900"
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

        <div className="relative shrink-0 p-4">
          <div className={cn("flex items-center gap-3 rounded-2xl border p-3 text-xs", look.footer)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-slate-900">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-heading text-[13px] font-bold">{theme.tagline}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">SchoolOS</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
