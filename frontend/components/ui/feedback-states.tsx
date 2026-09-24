import React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./button";

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-3.5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-gradient-to-r from-slate-100 via-slate-200/60 to-slate-100 w-full border border-slate-200/50" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200/80 bg-slate-50/50 p-10 sm:p-12 text-center my-6">
      <div className="rounded-2xl bg-brand-soft p-4 text-brand mb-4 shadow-subtle ring-4 ring-brand/5">
        <Icon className="h-8 w-8" />
      </div>
      <h4 className="font-heading text-lg font-bold text-slate-800">{title}</h4>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message = "Failed to load operational data. Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center my-6">
      <div className="rounded-2xl bg-rose-100 p-3.5 text-rose-600 mb-3 shadow-subtle">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="font-heading text-base font-bold text-rose-900">{title}</h4>
      <p className="mt-1 max-w-md text-sm text-rose-600 leading-relaxed">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 border-rose-300 text-rose-700 hover:bg-rose-100/80">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}
