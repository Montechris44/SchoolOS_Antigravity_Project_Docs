"use client";

import React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/portal";

export interface CredentialRow {
  label: string;
  email?: string;
  password: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand"
      aria-label="Copy"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/**
 * Shows one-time sign-in details to the administrator. The temporary password is never stored in the browser
 * and cannot be retrieved again — the person must change it the first time they sign in.
 */
export function CredentialsDialog({ rows, onClose, title = "Sign-in details" }: { rows: CredentialRow[] | null; onClose: () => void; title?: string }) {
  const downloadCsv = () => {
    if (!rows) return;
    const csv = ["name,email,temporary_password", ...rows.map((r) => [r.label, r.email ?? "", r.password].map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "schoolos-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog isOpen={rows !== null} onClose={onClose} title={title} description="Share these details privately with the account holder." maxWidth="lg">
      <Alert tone="warning">
        <KeyRound className="mr-1 inline h-3.5 w-3.5" /> This password is shown <strong>once</strong>. They will be asked to choose their own the first time they sign in.
      </Alert>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {rows?.map((row, index) => (
          <div key={`${row.label}-${index}`} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-bold text-slate-800">{row.label}</p>
            {row.email && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                <span className="text-slate-500">Login</span>
                <span className="flex items-center gap-1 font-mono text-slate-800">
                  {row.email}
                  <CopyButton value={row.email} />
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
              <span className="text-slate-500">Temporary password</span>
              <span className="flex items-center gap-1 font-mono font-bold text-slate-900">
                {row.password}
                <CopyButton value={row.password} />
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {rows && rows.length > 1 && (
          <Button variant="outline" onClick={downloadCsv}>
            Download CSV
          </Button>
        )}
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}
