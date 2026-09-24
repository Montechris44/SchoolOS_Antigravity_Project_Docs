"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="no-print mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
            {eyebrow}
          </span>
        )}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm sm:text-base text-slate-500 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

const TONES = {
  brand: "bg-brand-soft text-brand ring-4 ring-brand/5",
  emerald: "bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/5",
  amber: "bg-amber-50 text-amber-600 ring-4 ring-amber-500/5",
  rose: "bg-rose-50 text-rose-600 ring-4 ring-rose-500/5",
  violet: "bg-violet-50 text-violet-600 ring-4 ring-violet-500/5",
  sky: "bg-sky-50 text-sky-600 ring-4 ring-sky-500/5",
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
  const body = (
    <div
      className={cn(
        "group relative h-full rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-subtle transition-all duration-200 overflow-hidden",
        href && "hover:-translate-y-1 hover:border-slate-300 hover:shadow-card-hover cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105", TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="font-heading text-3xl font-black tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">{label}</div>
      {hint && <div className="mt-2.5 text-[11px] font-medium tracking-wide text-slate-400">{hint}</div>}
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
    <section className={cn("rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-subtle transition-all", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {title && <h2 className="font-heading text-lg font-bold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-sky-200/80 bg-sky-50/80 text-sky-900",
    success: "border-emerald-200/80 bg-emerald-50/80 text-emerald-900",
    error: "border-rose-200/80 bg-rose-50/80 text-rose-900",
    warning: "border-amber-200/80 bg-amber-50/80 text-amber-900",
  } as const;
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-sm font-medium shadow-2xs", styles[tone], className)} role={tone === "error" ? "alert" : undefined}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; active: T; onChange: (id: T) => void }) {
  return (
    <div className="no-print mb-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-1.5 shadow-subtle">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 cursor-pointer",
            active === tab.id ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", active === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{tab.count}</span>
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
        <label htmlFor={id} className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={ref}
        className={cn(
          "flex min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-subtle focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
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
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-2xl object-cover ring-2 ring-slate-100 shadow-2xs" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-soft to-blue-100 font-bold text-brand ring-2 ring-brand/10 shadow-2xs" style={{ width: size, height: size, fontSize: size / 2.7 }}>
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
