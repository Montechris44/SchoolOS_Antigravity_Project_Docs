"use client";

import React, { useState } from "react";
import { CalendarPlus, CheckCircle2, Lock, Plus, Unlock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, useLoader } from "@/components/ui/portal";
import { ApiError } from "@/lib/api/client";
import { createSession, createTerm, deactivateTerm, getAcademicStatus, reactivateTerm, setCurrentSession, setCurrentTerm } from "@/lib/api/portal-academics";
import { formatDate } from "@/lib/utils";

const TERM_NAMES = ["First Term", "Second Term", "Third Term"];

export default function CalendarPage() {
  const { data, error, loading, reload } = useLoader(getAcademicStatus, []);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [sessionForm, setSessionForm] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const [termForm, setTermForm] = useState<{ sessionId: string; name: string; startDate: string; endDate: string } | null>(null);

  const run = async (text: string, action: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text });
      reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "That did not work. Please try again." });
    }
  };

  return (
    <AppShell allow={["owner", "admin"]}>
      <PageHeader
        eyebrow="Academic structure"
        title="Academic Calendar"
        description="Sessions and terms. The current term drives results, timetables and attendance. Deactivating a term closes it to teachers while keeping its history."
        actions={<Button onClick={() => setSessionForm({ name: "", startDate: "", endDate: "" })}><CalendarPlus className="mr-2 h-4 w-4" /> New session</Button>}
      />

      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {loading ? <LoadingSkeleton count={3} /> : error || !data ? <ErrorState message={error ?? undefined} onRetry={reload} /> : (
        <div className="space-y-5">
          {data.sessions.map((session) => {
            const terms = data.terms.filter((t) => t.sessionId === session.id);
            return (
              <Panel key={session.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-xl font-bold text-slate-900">{session.name}</h2>
                      {session.isCurrent && <Badge variant="success">Current session</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(session.startDate)} – {formatDate(session.endDate)}</p>
                  </div>
                  <div className="flex gap-2">
                    {!session.isCurrent && <Button size="sm" variant="outline" onClick={() => run(`${session.name} is now the current session.`, () => setCurrentSession(session.id))}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Make current</Button>}
                    <Button size="sm" variant="outline" onClick={() => setTermForm({ sessionId: session.id, name: TERM_NAMES.find((n) => !terms.some((t) => t.name === n)) ?? TERM_NAMES[0], startDate: "", endDate: "" })}><Plus className="mr-1.5 h-3.5 w-3.5" /> Term</Button>
                  </div>
                </div>
                {terms.length === 0 ? <p className="text-sm text-slate-400">No terms yet.</p> : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {terms.map((term) => (
                      <div key={term.id} className={`rounded-2xl border p-4 ${term.isCurrent ? "border-brand bg-brand-soft" : "border-slate-200"}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900">{term.name}</p>
                          <div className="flex gap-1">
                            {term.isCurrent && <Badge variant="success">Current</Badge>}
                            {!term.isActive && <Badge variant="secondary">Closed</Badge>}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(term.startDate)} – {formatDate(term.endDate)}</p>
                        <div className="mt-3 flex gap-2">
                          {!term.isCurrent && term.isActive && <Button size="sm" variant="outline" onClick={() => run(`${term.name} is now current.`, () => setCurrentTerm(term.id))}>Make current</Button>}
                          {term.isActive ? (
                            <Button size="sm" variant="ghost" onClick={() => run(`${term.name} closed.`, () => deactivateTerm(term.id))}><Lock className="mr-1 h-3.5 w-3.5" /> Close</Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => run(`${term.name} re-opened.`, () => reactivateTerm(term.id))}><Unlock className="mr-1 h-3.5 w-3.5" /> Re-open</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog isOpen={sessionForm !== null} onClose={() => setSessionForm(null)} title="New academic session">
        {sessionForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Session created.", () => createSession(sessionForm)).then(() => setSessionForm(null)); }}>
            <Input label="Name" required placeholder="2026/2027" value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Starts" type="date" required value={sessionForm.startDate} onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })} />
              <Input label="Ends" type="date" required value={sessionForm.endDate} onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSessionForm(null)}>Cancel</Button><Button type="submit">Create session</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={termForm !== null} onClose={() => setTermForm(null)} title="Add a term">
        {termForm && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run("Term added.", () => createTerm(termForm)).then(() => setTermForm(null)); }}>
            <Select label="Term" value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}>
              {TERM_NAMES.map((n) => <option key={n}>{n}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Starts" type="date" required value={termForm.startDate} onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })} />
              <Input label="Ends" type="date" required value={termForm.endDate} onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setTermForm(null)}>Cancel</Button><Button type="submit">Add term</Button></div>
          </form>
        )}
      </Dialog>
    </AppShell>
  );
}
