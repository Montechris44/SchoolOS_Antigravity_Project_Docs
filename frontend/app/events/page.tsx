"use client";

import React, { useState } from "react";
import { CalendarDays, MapPin, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, PageHeader, Panel, Textarea, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { createEvent, deleteEvent, listEvents } from "@/lib/api/portal-daily";
import { SchoolEvent } from "@/types/portal";
import { formatDate } from "@/lib/utils";

const TYPES: SchoolEvent["eventType"][] = ["ACADEMIC", "SOCIAL", "SPORTS", "EXAMINATION", "HOLIDAY", "OTHER"];
const TYPE_STYLE: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  ACADEMIC: "default", SOCIAL: "secondary", SPORTS: "success", EXAMINATION: "warning", HOLIDAY: "destructive", OTHER: "secondary",
};

export default function EventsPage() {
  const { can } = useAuth();
  const canManage = can("events:manage");
  const events = useLoader(() => listEvents(), []);
  const [form, setForm] = useState<{ title: string; description: string; eventType: SchoolEvent["eventType"]; startDate: string; endDate: string; location: string; isPublic: boolean } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    try {
      await createEvent({ title: form.title, description: form.description || null, eventType: form.eventType, startDate: new Date(form.startDate).toISOString(), endDate: form.endDate ? new Date(form.endDate).toISOString() : null, location: form.location || null, isPublic: form.isPublic });
      setForm(null);
      events.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not save the event." });
    }
  };

  const now = Date.now();
  const upcoming = (events.data ?? []).filter((e) => new Date(e.endDate ?? e.startDate).getTime() >= now).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = (events.data ?? []).filter((e) => new Date(e.endDate ?? e.startDate).getTime() < now);

  const card = (event: SchoolEvent, muted = false) => (
    <Panel key={event.id} className={`!p-5 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <span className="text-[10px] font-bold uppercase">{new Date(event.startDate).toLocaleString("en-GB", { month: "short" })}</span>
          <span className="font-heading text-xl font-bold leading-none">{new Date(event.startDate).getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading font-bold text-slate-900">{event.title}</h3>
            <div className="flex items-center gap-1">
              <Badge variant={TYPE_STYLE[event.eventType]}>{event.eventType.toLowerCase()}</Badge>
              {canManage && <button aria-label="Delete event" onClick={async () => { if (window.confirm("Delete this event?")) { await deleteEvent(event.id).catch(() => undefined); events.reload(); } }} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
          <p className="text-xs text-slate-500">{formatDate(event.startDate)}{event.endDate ? ` – ${formatDate(event.endDate)}` : ""}</p>
          {event.location && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{event.location}</p>}
          {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
          {!event.isPublic && <Badge variant="outline" className="mt-2">Staff only</Badge>}
        </div>
      </div>
    </Panel>
  );

  return (
    <AppShell>
      <PageHeader eyebrow="Community" title="School Events" description="Holidays, exams, sports and everything else on the school calendar." actions={canManage && <Button onClick={() => setForm({ title: "", description: "", eventType: "ACADEMIC", startDate: "", endDate: "", location: "", isPublic: true })}><Plus className="mr-2 h-4 w-4" /> Add event</Button>} />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      {events.loading ? <LoadingSkeleton count={4} /> : events.error || !events.data ? <ErrorState message={events.error ?? undefined} onRetry={events.reload} /> : events.data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No events yet" description="Upcoming events will be listed here." />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-heading text-lg font-bold">Upcoming</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{upcoming.length ? upcoming.map((e) => card(e)) : <p className="text-sm text-slate-400">Nothing scheduled.</p>}</div>
          </div>
          {past.length > 0 && <div><h2 className="mb-3 font-heading text-lg font-bold text-slate-500">Past</h2><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{past.slice(0, 10).map((e) => card(e, true))}</div></div>}
        </div>
      )}

      <Dialog isOpen={form !== null} onClose={() => setForm(null)} title="Add an event" maxWidth="lg">
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Type" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as SchoolEvent["eventType"] })}>{TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</Select>
              <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input label="Starts" type="datetime-local" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Input label="Ends" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Visible to students and parents</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit">Save event</Button></div>
          </form>
        )}
      </Dialog>
    </AppShell>
  );
}
