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
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {label}
          </label>
        )}
        <select
          id={id}
          className={cn(
            "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-500 focus-visible:ring-rose-500",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
