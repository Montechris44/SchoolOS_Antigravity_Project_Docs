"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./reveal";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="no-print mb-6 sm:mb-8 flex flex-col gap-4 border-b-2 border-dashed border-brand/20 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <span className="mb-2.5 inline-flex -rotate-1 items-center gap-1.5 rounded-md bg-gold-soft px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-800 ring-1 ring-gold/50">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 text-balance sm:text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm sm:text-base text-slate-500 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

const TONES = {
  brand: { chip: "bg-brand text-white", tab: "bg-brand", soft: "bg-brand-soft" },
  emerald: { chip: "bg-green-600 text-white", tab: "bg-green-600", soft: "bg-green-50" },
  amber: { chip: "bg-gold text-slate-900", tab: "bg-gold", soft: "bg-gold-soft" },
  rose: { chip: "bg-rose-600 text-white", tab: "bg-rose-600", soft: "bg-rose-50" },
  violet: { chip: "bg-violet-600 text-white", tab: "bg-violet-600", soft: "bg-violet-50" },
  sky: { chip: "bg-teal-600 text-white", tab: "bg-teal-600", soft: "bg-teal-50" },
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ElementType;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const t = TONES[tone];
  // Styled like a folder / report-card tab: coloured edge along the top, icon stamped in the corner.
  const body = (
    <div
      className={cn(
        "group relative h-full animate-rise-in overflow-hidden rounded-2xl border border-slate-200 bg-card p-5 pt-6 shadow-subtle transition-all duration-200",
        href && "hover:-translate-y-1 hover:border-brand/40 hover:shadow-card-hover cursor-pointer"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1.5", t.tab)} />
      <div className={cn("pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-60 transition-transform duration-300 group-hover:scale-125", t.soft)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1.5 break-words font-heading text-3xl font-black tracking-tight text-slate-900">{typeof value === "number" ? <CountUp value={value} /> : value}</div>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110", t.chip)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint && <div className="relative mt-3 text-xs font-medium text-slate-500">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("animate-rise-in rounded-2xl border border-slate-200 bg-card p-5 sm:p-6 shadow-subtle transition-all", className)}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-3">
          {title && (
            <h2 className="flex items-center gap-2.5 font-heading text-lg font-bold text-slate-900">
              <span className="h-5 w-1.5 rounded-full bg-gold" />
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-gold/60 border-l-gold bg-gold-soft text-slate-900",
    success: "border-green-300/70 border-l-green-600 bg-green-50 text-green-900",
    error: "border-rose-300/70 border-l-rose-600 bg-rose-50 text-rose-900",
    warning: "border-amber-300/70 border-l-amber-500 bg-amber-50 text-amber-900",
  } as const;
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-l-4 p-3.5 text-sm font-medium shadow-2xs", styles[tone], className)} role={tone === "error" ? "alert" : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

/** Folder-tab navigation: the active tab "opens" into the page below it. */
export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; active: T; onChange: (id: T) => void }) {
  return (
    <div className="no-print mb-6 flex gap-1 overflow-x-auto border-b-2 border-slate-200 [scrollbar-width:none]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative -mb-0.5 flex shrink-0 cursor-pointer items-center gap-2 rounded-t-xl border-2 border-b-0 px-4 py-2.5 text-sm font-bold transition-all duration-150",
            active === tab.id
              ? "border-slate-200 bg-card text-brand-strong shadow-[inset_0_3px_0_0_rgb(var(--brand-rgb))] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-card"
              : "border-transparent text-slate-500 hover:bg-brand-soft/60 hover:text-slate-900"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", active === tab.id ? "bg-brand text-white" : "bg-slate-200 text-slate-600")}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  ({ className, label, id, ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-slate-600">
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        className={cn(
          "flex min-h-[90px] w-full rounded-xl border-2 border-slate-200 bg-card px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-subtle hover:border-slate-300 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15",
          className
        )}
        {...props}
      />
    </div>
  )
);
Textarea.displayName = "Textarea";

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-gold/60 shadow-2xs" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-soft to-gold-soft font-black text-brand-strong ring-2 ring-gold/60 shadow-2xs" style={{ width: size, height: size, fontSize: size / 2.7 }}>
      {initials}
    </div>
  );
}

export function statusTone(status: string): "success" | "warning" | "destructive" | "secondary" | "default" {
  const s = status.toUpperCase();
  if (["APPROVED", "PUBLISHED", "PRESENT", "ON_TIME", "GRADED", "PAID", "ACTIVE"].includes(s)) return "success";
  if (["PENDING", "PENDING_REVIEW", "LATE", "IN_PROGRESS", "PUBLISHED_TO_CLASS_TEACHER", "NEEDS_REPUBLISH", "EXCUSED", "VERY_LATE", "SUBMITTED", "PARTIAL"].includes(s)) return "warning";
  if (["REJECTED", "RETURNED_FOR_CORRECTION", "ABSENT", "CANCELLED", "OVERDUE"].includes(s)) return "destructive";
  if (["DRAFT", "NOT_STARTED", "ON_LEAVE"].includes(s)) return "secondary";
  return "default";
}

export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Small controlled loader hook: runs `load` on mount and whenever `deps` change. */
export function useLoader<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick((n) => n + 1), setData };
}
