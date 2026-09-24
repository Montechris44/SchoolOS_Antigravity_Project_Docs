"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, School as SchoolIcon, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_LABELS } from "@/lib/auth/types";
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/portal-daily";
import { NotificationItem } from "@/types/portal";
import { cn, formatDate } from "@/lib/utils";

const POLL_MS = 60_000;

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    getUnreadCount()
      .then((result) => setUnread(result.unread))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      listNotifications()
        .then((rows) => setItems(rows.slice(0, 8)))
        .catch(() => undefined);
    }
  };

  const readOne = async (item: NotificationItem) => {
    if (item.readAt) return;
    await markNotificationRead(item.id).catch(() => undefined);
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)));
    refreshCount();
  };

  const readAll = async () => {
    await markAllNotificationsRead().catch(() => undefined);
    setItems((prev) => prev.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} title="Notifications" className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white shadow-2xs">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2.5 w-84 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-elevated animate-slide-up">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
            <span className="font-heading text-sm font-bold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-semibold text-brand hover:underline cursor-pointer">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">You are all caught up.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => readOne(item)}
                  className={cn("block w-full px-5 py-3.5 text-left transition-colors hover:bg-slate-50 cursor-pointer", !item.readAt && "bg-brand-soft/40")}
                >
                  <div className="flex items-start gap-2.5">
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500 mt-0.5 leading-relaxed">{item.message}</p>
                      <p className="mt-1.5 text-[10px] font-medium text-slate-400">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <Link href="/messages" onClick={() => setOpen(false)} className="block border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center text-xs font-semibold text-brand hover:bg-slate-100 transition-colors">
            Open messages inbox
          </Link>
        </div>
      )}
    </div>
  );
}

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, school, role, logout } = useAuth();

  return (
    <header className="no-print sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-8 shadow-2xs">
      <div className="flex items-center gap-3">
        <button onClick={onOpenSidebar} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer">
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs">
          <SchoolIcon className="h-4 w-4 text-brand" />
          <span className="hidden font-bold sm:inline">{school?.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <NotificationBell />

        <div className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-bold text-brand shadow-2xs">
          <Shield className="h-3.5 w-3.5" />
          <span>{ROLE_LABELS[role]}</span>
        </div>

        <Link href="/account" title="My account" className="hidden items-center gap-2.5 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-1 pr-3 hover:bg-slate-100/80 transition-all sm:flex shadow-2xs">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-strong text-[11px] font-bold text-white shadow-2xs">
            {user?.fullName.slice(0, 2).toUpperCase() || "SO"}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-tight text-slate-800">{user?.fullName}</span>
            <span className="text-[10px] font-medium text-slate-400">{user?.email}</span>
          </div>
        </Link>

        <button onClick={logout} title="Sign out" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
