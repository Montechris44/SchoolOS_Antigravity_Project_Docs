import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    // "Pressed paper" buttons: a solid ledge underneath that squashes on click, like a classroom stamp.
    const baseStyles =
      "relative inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 rounded-full select-none cursor-pointer";

    const variants = {
      primary:
        "bg-brand text-white shadow-press-sm hover:-translate-y-px hover:bg-brand hover:brightness-110 hover:shadow-press active:translate-y-[2px] active:shadow-none",
      secondary:
        "bg-gold-soft text-slate-900 border border-gold/40 shadow-[0_2px_0_0_rgb(var(--gold-rgb)/0.55)] hover:-translate-y-px hover:bg-gold/30 active:translate-y-[2px] active:shadow-none",
      outline:
        "border-2 border-brand/25 bg-card text-brand-strong hover:border-brand hover:bg-brand-soft active:scale-[0.98]",
      ghost: "text-slate-600 hover:bg-brand-soft hover:text-brand-strong active:scale-[0.98]",
      destructive:
        "bg-rose-700 text-white shadow-[0_2px_0_0_#881337] hover:-translate-y-px hover:bg-rose-600 active:translate-y-[2px] active:shadow-none",
      accent:
        "bg-gold text-slate-900 shadow-[0_2px_0_0_rgb(0_0_0/0.28)] hover:-translate-y-px hover:brightness-105 active:translate-y-[2px] active:shadow-none",
    };

    const sizes = {
      sm: "h-8.5 px-3.5 text-xs gap-1.5",
      md: "h-10.5 px-5 text-sm gap-2",
      lg: "h-12 px-7 text-base gap-2.5",
      icon: "h-10 w-10 p-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
