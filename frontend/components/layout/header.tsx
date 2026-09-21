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
      <button onClick={toggle} title="Notifications" className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-semibold text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">You are all caught up.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => readOne(item)}
                  className={cn("block w-full border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50", !item.readAt && "bg-brand-soft")}
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{item.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <Link href="/messages" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-brand hover:bg-slate-50">
            Open messages
          </Link>
        </div>
      )}
    </div>
  );
}

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, school, role, logout } = useAuth();

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs lg:px-8">
      <div className="flex items-center gap-3">
        <button onClick={onOpenSidebar} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
          <SchoolIcon className="h-4 w-4 text-brand" />
          <span className="hidden font-bold sm:inline">{school?.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell />

        <div className="flex items-center gap-2 rounded-xl border border-brand-soft bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand shadow-xs">
          <Shield className="h-3.5 w-3.5" />
          <span className="font-bold">{ROLE_LABELS[role]}</span>
        </div>

        <Link href="/account" title="My account" className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow-xs">
            {user?.fullName.slice(0, 2).toUpperCase() || "SO"}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-tight text-slate-800">{user?.fullName}</span>
            <span className="text-[10px] font-medium text-slate-400">{user?.email}</span>
          </div>
        </Link>

        <button onClick={logout} title="Sign out" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
