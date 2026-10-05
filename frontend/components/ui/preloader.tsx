"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

const CACHE_KEY = "schoolos.preloader";
const FIRST_LOAD_MIN_MS = 1100;
const ROUTE_MIN_MS = 650;
const EXIT_MS = 450;

interface Brand {
  name: string | null;
  logoUrl: string | null;
  role: string | null;
}

const MESSAGES = ["Opening the school gates…", "Sharpening pencils…", "Taking the register…", "Setting up your desk…"];

function readCache(): Brand | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Brand) : null;
  } catch {
    return null;
  }
}

function writeCache(brand: Brand) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(brand));
  } catch {
    /* storage unavailable: the default logo is used next time */
  }
}

/**
 * Full-screen loader shown before any page opens and between page changes.
 * It shows the school's own logo; when a school has no logo (or nobody is signed in yet) the default SchoolOS crest is used.
 */
export function Preloader() {
  const { school, role, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [cached, setCached] = useState<Brand | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [msg, setMsg] = useState(0);
  const firstLoadAt = useRef<number>(Date.now());
  const firstDone = useRef(false);
  const lastPath = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Remember the school's branding so the very next visit can show its logo straight away.
  useEffect(() => {
    setCached(readCache());
  }, []);
  useEffect(() => {
    if (isAuthenticated && school) writeCache({ name: school.name, logoUrl: school.logoUrl ?? null, role });
  }, [isAuthenticated, school, role]);

  const hide = () => {
    setLeaving(true);
    later(() => {
      setVisible(false);
      setLeaving(false);
    }, EXIT_MS);
  };

  // First load: stay until the session check is done (and for a minimum time so the animation can be seen).
  useEffect(() => {
    if (isLoading || firstDone.current) return;
    firstDone.current = true;
    lastPath.current = pathname;
    const wait = Math.max(0, FIRST_LOAD_MIN_MS - (Date.now() - firstLoadAt.current));
    later(hide, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Every later page change gets a short loader too.
  useEffect(() => {
    if (!firstDone.current) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setLeaving(false);
    setVisible(true);
    later(hide, ROUTE_MIN_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1100);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // Stop the page behind from scrolling while the loader is up.
  useEffect(() => {
    document.body.style.overflow = visible ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  if (!visible) return null;

  const live = isAuthenticated && school ? { name: school.name, logoUrl: school.logoUrl ?? null, role } : null;
  const brand = live ?? cached;
  const logo = brand?.logoUrl && !logoFailed ? brand.logoUrl : null;
  const portalRole = brand?.role ?? undefined;

  return (
    <div
      data-role={portalRole}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={`bg-grid-paper fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 transition-all duration-[450ms] ease-out ${
        leaving ? "pointer-events-none scale-105 opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute -left-16 top-1/4 h-56 w-56 animate-float rounded-full bg-gold/20" />
      <div className="pointer-events-none absolute -right-10 bottom-1/4 h-44 w-44 animate-float rounded-full bg-brand/10 [animation-delay:1.5s]" />

      <div className="relative flex h-40 w-40 items-center justify-center">
        {/* Orbiting ring */}
        <div className="absolute inset-0 animate-spin-slow rounded-full border-[3px] border-dashed border-brand/30" />
        <div className="absolute inset-3 animate-spin-slow rounded-full border-2 border-transparent border-t-brand [animation-direction:reverse]" />
        <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 animate-ping rounded-full bg-gold" />

        {/* Logo: the school's own, or the default crest */}
        <div className="animate-logo-bounce flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 border-brand/20 bg-card shadow-elevated">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-contain p-2" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-brand text-white">
              <GraduationCap className="h-12 w-12" />
            </span>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-center font-heading text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{brand?.name || "SchoolOS"}</h2>
      <p key={msg} className="mt-1.5 animate-fade-in text-center text-sm font-semibold text-slate-500">
        {MESSAGES[msg]}
      </p>

      <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-brand/15">
        <div className="h-full w-1/3 animate-load-bar rounded-full bg-brand" />
      </div>
    </div>
  );
}
