import React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "./button";

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-200/70 w-full" />
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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center my-6">
      <div className="rounded-full bg-blue-50 p-4 text-blue-600 mb-4">
        <Icon className="h-8 w-8" />
      </div>
      <h4 className="text-base font-bold text-slate-800">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center my-6">
      <div className="rounded-full bg-rose-100 p-3 text-rose-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-base font-bold text-rose-900">{title}</h4>
      <p className="mt-1 max-w-md text-sm text-rose-600">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 border-rose-300 text-rose-700 hover:bg-rose-100">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  );
}
