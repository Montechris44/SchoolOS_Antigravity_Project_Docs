"use client";

import React, { useEffect, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { getGradeBands, getPortalSettings, saveGradeBands, updatePortalSettings } from "@/lib/api/portal-academics";
import { GradeBand } from "@/types/portal";

const WAEC: GradeBand[] = [
  { minScore: 75, maxScore: 100, grade: "A1", remark: "Excellent", isPass: true },
  { minScore: 70, maxScore: 74.99, grade: "B2", remark: "Very good", isPass: true },
  { minScore: 65, maxScore: 69.99, grade: "B3", remark: "Good", isPass: true },
  { minScore: 60, maxScore: 64.99, grade: "C4", remark: "Credit", isPass: true },
  { minScore: 55, maxScore: 59.99, grade: "C5", remark: "Credit", isPass: true },
  { minScore: 50, maxScore: 54.99, grade: "C6", remark: "Credit", isPass: true },
  { minScore: 45, maxScore: 49.99, grade: "D7", remark: "Pass", isPass: true },
  { minScore: 40, maxScore: 44.99, grade: "E8", remark: "Weak pass", isPass: true },
  { minScore: 0, maxScore: 39.99, grade: "F9", remark: "Fail", isPass: false },
];

export default function GradingPage() {
  const bands = useLoader(getGradeBands, []);
  const settings = useLoader(getPortalSettings, []);
  const [draft, setDraft] = useState<GradeBand[]>([]);
  const [passMark, setPassMark] = useState("50");
  const [rankingMode, setRankingMode] = useState("AUTO");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (bands.data) setDraft(bands.data.map((b) => ({ ...b })));
  }, [bands.data]);
  useEffect(() => {
    if (settings.data) {
      setPassMark(String(settings.data.passMark));
      setRankingMode(settings.data.rankingMode);
    }
  }, [settings.data]);

  const change = (index: number, patch: Partial<GradeBand>) => setDraft((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await saveGradeBands(draft);
      await updatePortalSettings({ passMark: Number(passMark), rankingMode: rankingMode as "AUTO" | "AVERAGE" | "SSS_GRADE_COUNTS" });
      setNotice({ tone: "success", text: "Grading scale and ranking rules saved." });
      bands.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save the grading scale." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader
        eyebrow="Results"
        title="Grading Scale"
        description="The bands used for every subject grade. Bands must cover 0–100 without gaps or overlaps. Changes apply to scores saved from now on."
        actions={<Button variant="outline" onClick={() => setDraft(WAEC.map((b) => ({ ...b })))}><RotateCcw className="mr-2 h-4 w-4" /> Use WAEC defaults</Button>}
      />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {bands.loading ? <LoadingSkeleton count={5} /> : bands.error ? <ErrorState message={bands.error} onRetry={bands.reload} /> : (
        <div className="space-y-6">
          <Panel title="Grade bands">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr><th className="pb-2">Grade</th><th className="pb-2">From</th><th className="pb-2">To</th><th className="pb-2">Remark</th><th className="pb-2 text-center">Pass</th><th /></tr>
                </thead>
                <tbody>
                  {draft.map((band, index) => (
                    <tr key={index}>
                      <td className="py-1 pr-2"><input value={band.grade} maxLength={5} onChange={(e) => change(index, { grade: e.target.value })} className="h-9 w-20 rounded-lg border border-slate-300 px-2 font-bold" /></td>
                      <td className="py-1 pr-2"><input type="number" step="0.01" value={band.minScore} onChange={(e) => change(index, { minScore: Number(e.target.value) })} className="h-9 w-24 rounded-lg border border-slate-300 px-2" /></td>
                      <td className="py-1 pr-2"><input type="number" step="0.01" value={band.maxScore} onChange={(e) => change(index, { maxScore: Number(e.target.value) })} className="h-9 w-24 rounded-lg border border-slate-300 px-2" /></td>
                      <td className="py-1 pr-2"><input value={band.remark ?? ""} onChange={(e) => change(index, { remark: e.target.value })} className="h-9 w-full rounded-lg border border-slate-300 px-2" /></td>
                      <td className="py-1 text-center"><input type="checkbox" checked={band.isPass} onChange={(e) => change(index, { isPass: e.target.checked })} /></td>
                      <td className="py-1 pl-2"><button aria-label="Remove band" onClick={() => setDraft(draft.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDraft([...draft, { minScore: 0, maxScore: 0, grade: "", remark: "", isPass: true }])}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add band</Button>
          </Panel>

          <Panel title="Pass mark & ranking">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                Pass mark
                <input type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(e.target.value)} className="mt-1.5 flex h-10 w-full rounded-lg border border-slate-300 px-3 text-sm normal-case" />
                <span className="block text-[11px] font-normal normal-case text-slate-400">Used to count passed and failed subjects on report cards.</span>
              </label>
              <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                Class position rule
                <select value={rankingMode} onChange={(e) => setRankingMode(e.target.value)} className="mt-1.5 flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm normal-case">
                  <option value="AUTO">Automatic — average for Primary/JSS, grade counts for Senior Secondary</option>
                  <option value="AVERAGE">Always by average score</option>
                  <option value="SSS_GRADE_COUNTS">Always by grade counts (most A&apos;s first)</option>
                </select>
              </label>
            </div>
          </Panel>

          <div className="flex justify-end">
            <Button size="lg" onClick={save} isLoading={busy}><Save className="mr-2 h-4 w-4" /> Save grading rules</Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
