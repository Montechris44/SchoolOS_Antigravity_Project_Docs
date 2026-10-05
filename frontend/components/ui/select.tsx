import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {label}
          </label>
        )}
        <select
          id={id}
          className={cn(
            "flex h-10.5 w-full rounded-xl border-2 border-slate-200 bg-card px-3.5 py-2 text-sm text-slate-900 transition-all shadow-subtle hover:border-slate-300 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/20",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
