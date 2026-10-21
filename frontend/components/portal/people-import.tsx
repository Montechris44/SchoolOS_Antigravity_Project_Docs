"use client";
import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/portal";
import { CredentialsDialog, CredentialRow } from "./credentials-dialog";
import { apiRequest } from "@/lib/api/client";
import { PeopleField, PeopleKind } from "@/types/people-fields";

interface Preview {
  fields: PeopleField[];
  headers: string[];
  mappings: Array<string | null>;
  errors: string[];
  rows: Array<{ index: number; data: Record<string, any>; displayValues: Record<string, string>; errors: string[] }>;
  previewToken: string;
}
interface ImportResult {
  success: Array<{ index: number; record: { firstName: string; lastName: string }; credentials: { email: string; temporaryPassword: string } | null }>;
  failed: Array<{ index: number; error: string }>;
}
export function PeopleImport({ kind, fields, onSaved, disabled }: { kind: PeopleKind; fields: PeopleField[]; onSaved: () => void; disabled?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ImportResult | null>(null);
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const path = kind === "student" ? "/students/import" : "/staff/import";
  const read = async (selected: File) => {
    setOpen(true); setBusy(true); setError(""); setPreview(null); setReport(null);
    try {
      if (selected.size > 1_000_000) throw new Error("Choose a CSV file smaller than 1 MB (up to 300 records).");
      const text = await selected.text();
      setCsv(text);
      setPreview(await apiRequest<Preview>(`${path}/preview`, { method: "POST", body: { csv: text } }));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not read the CSV."); }
    finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  const save = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const result = await apiRequest<ImportResult>(path, { method: "POST", body: { csv, previewToken: preview.previewToken } });
      setReport(result); setPreview(null); onSaved();
      const rows = result.success.flatMap((r) => r.credentials ? [{ label: `${r.record.firstName} ${r.record.lastName}`, email: r.credentials.email, password: r.credentials.temporaryPassword }] : []);
      if (rows.length) setCredentials(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      // A lost response may follow successful writes; require a new preview before retrying.
      setPreview(null);
      onSaved();
    } finally { setBusy(false); }
  };
  const template = () => {
    const text = fields.filter((f) => f.enabled).map((f) => `"${f.label.replace(/"/g, '""')}"`).join(",") + "\r\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}-import-template.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const valid = preview && !preview.errors.length && preview.rows.every((r) => !r.errors.length);
  return <>
    <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
    <Button variant="outline" disabled={disabled || busy} onClick={() => file.current?.click()}><Upload className="mr-2 h-4 w-4" />Import {kind} CSV</Button>
    <Button variant="ghost" disabled={disabled} onClick={template}>CSV template</Button>
    <Dialog isOpen={open && credentials === null} onClose={() => !busy && setOpen(false)} title={`Preview ${kind} import`} maxWidth="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Check the mapping and every row before saving. Nothing is saved during preview. Fix errors in the CSV or your school field settings, then choose the file again.</p>
        {busy && <p role="status">{preview ? "Saving records..." : "Reading and validating CSV..."}</p>}
        {error && <Alert tone="error">{error}</Alert>}
        {preview && <>
          {preview.errors.map((message, i) => <Alert key={i} tone="error">{message}</Alert>)}
          <div className="max-h-40 overflow-auto rounded-lg border p-3 text-sm"><strong>Column mapping</strong>{preview.headers.map((h, i) => <p key={i}>{h} → {preview.mappings[i] ?? "Unmapped"}</p>)}</div>
          <p className="text-sm">{preview.rows.length} record(s), {preview.rows.filter((r) => r.errors.length).length} with errors.</p>
          <div className="max-h-80 space-y-3 overflow-auto">{preview.rows.map((row) => <div key={row.index} className="rounded-lg border p-3 text-sm">
            <strong>Record {row.index + 1}: {row.data.firstName} {row.data.lastName}</strong>
            <dl className="mt-2 grid grid-cols-2 gap-2">{preview.fields.filter((f) => f.enabled).map((f) => {
              const guardianKey = f.key.slice(8, 9).toLowerCase() + f.key.slice(9);
              const value = row.displayValues?.[f.key] ?? row.data[f.key] ?? row.data.customFields?.[f.key] ?? (f.key.startsWith("guardian") ? row.data.guardian?.[guardianKey] : undefined);
              return <div key={f.key}><dt className="text-slate-500">{f.label}</dt><dd className="break-words">{String(value ?? "—")}</dd></div>;
            })}</dl>
            {row.errors.map((message, i) => <p key={i} className="mt-1 text-rose-600">{message}</p>)}
          </div>)}</div>
        </>}
        {report && <Alert tone={report.failed.length ? "warning" : "success"}>Saved {report.success.length} {kind}(s). {report.failed.map((r) => `Record ${r.index + 1}: ${r.error}`).join("; ")}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Close</Button><Button disabled={!valid || busy} isLoading={busy} onClick={save}>Save {preview?.rows.length ?? 0} {kind}(s)</Button></div>
      </div>
    </Dialog>
    <CredentialsDialog rows={credentials} onClose={() => setCredentials(null)} />
  </>;
}
