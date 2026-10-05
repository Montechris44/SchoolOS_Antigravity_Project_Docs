import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-brand-soft text-brand-strong border-brand/25",
    secondary: "bg-slate-100 text-slate-700 border-slate-200/80",
    success: "bg-green-50 text-green-800 border-green-300/70",
    warning: "bg-amber-50 text-amber-800 border-amber-300/70",
    destructive: "bg-rose-50 text-rose-800 border-rose-300/70",
    outline: "bg-transparent text-slate-700 border-slate-300/80",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
