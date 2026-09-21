"use client";

import React, { useState } from "react";
import { Mail, Megaphone, PenSquare, Reply } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { Alert, Avatar, PageHeader, Panel, Tabs, Textarea, useLoader } from "@/components/ui/portal";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { listPortalClasses } from "@/lib/api/portal-academics";
import { getInbox, getSent, getThread, listBroadcasts, listContacts, markBroadcastRead, markMessageRead, sendBroadcast, sendMessage } from "@/lib/api/portal-daily";
import { MessageItem } from "@/types/portal";
import { ROLE_LABELS } from "@/lib/auth/types";
import { UserRole } from "@/types";
import { formatDate } from "@/lib/utils";

type Tab = "inbox" | "sent" | "broadcasts";

export default function MessagesPage() {
  const { role } = useAuth();
  const canWrite = role !== "student";
  const canBroadcast = role === "owner" || role === "admin" || role === "teacher";
  const [tab, setTab] = useState<Tab>(role === "student" ? "broadcasts" : "inbox");

  const inbox = useLoader(async () => (canWrite ? getInbox() : []), [canWrite]);
  const sent = useLoader(async () => (canWrite ? getSent() : []), [canWrite]);
  const broadcasts = useLoader(listBroadcasts, []);
  const contacts = useLoader(async () => (canWrite ? listContacts() : []), [canWrite]);
  const classes = useLoader(async () => (canBroadcast ? listPortalClasses() : []), [canBroadcast]);

  const [compose, setCompose] = useState<{ recipientId: string; subject: string; body: string; parentId?: string } | null>(null);
  const [bcast, setBcast] = useState<{ classId: string; subject: string; body: string } | null>(null);
  const [thread, setThread] = useState<{ root: MessageItem; messages: Awaited<ReturnType<typeof getThread>> } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!compose) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendMessage({ recipientId: compose.recipientId, subject: compose.subject || undefined, body: compose.body, parentId: compose.parentId });
      setCompose(null);
      setNotice({ tone: "success", text: "Message sent." });
      sent.reload();
      if (thread) setThread({ ...thread, messages: await getThread(thread.root.parentId ?? thread.root.id) });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not send the message." });
    } finally {
      setBusy(false);
    }
  };

  const broadcast = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bcast) return;
    setBusy(true);
    try {
      const result = await sendBroadcast({ classId: bcast.classId || undefined, subject: bcast.subject || undefined, body: bcast.body });
      setBcast(null);
      setNotice({ tone: "success", text: `Announcement sent to ${result.recipientCount} student(s).` });
      broadcasts.reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not send the announcement." });
    } finally {
      setBusy(false);
    }
  };

  const openMessage = async (message: MessageItem, mine: boolean) => {
    if (!mine && message.status === "SENT") {
      await markMessageRead(message.id).catch(() => undefined);
      inbox.reload();
    }
    try {
      setThread({ root: message, messages: await getThread(message.parentId ?? message.id) });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not open the conversation." });
    }
  };

  const list = tab === "inbox" ? inbox : sent;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Community"
        title="Messages"
        description={canWrite ? "Direct messages between staff, and announcements to students." : "Announcements from your teachers and the school."}
        actions={
          <>
            {canBroadcast && <Button variant="outline" onClick={() => setBcast({ classId: "", subject: "", body: "" })}><Megaphone className="mr-2 h-4 w-4" /> Announce to students</Button>}
            {canWrite && <Button onClick={() => setCompose({ recipientId: "", subject: "", body: "" })}><PenSquare className="mr-2 h-4 w-4" /> New message</Button>}
          </>
        }
      />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}

      <Tabs
        tabs={[...(canWrite ? [{ id: "inbox" as Tab, label: "Inbox", count: inbox.data?.filter((m) => m.status === "SENT").length }, { id: "sent" as Tab, label: "Sent" }] : []), { id: "broadcasts" as Tab, label: "Announcements" }]}
        active={tab}
        onChange={setTab}
      />

      {tab === "broadcasts" ? (
        broadcasts.loading ? <LoadingSkeleton count={3} /> : broadcasts.error || !broadcasts.data ? <ErrorState message={broadcasts.error ?? undefined} onRetry={broadcasts.reload} /> : broadcasts.data.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements" description="Announcements from teachers and the school appear here." />
        ) : (
          <div className="space-y-3">
            {broadcasts.data.map((b) => (
              <Panel key={b.id} className={`!p-5 ${role === "student" && !b.readAt ? "border-brand" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-slate-900">{b.subject || "Announcement"}</h3>
                    <p className="text-xs text-slate-500">{b.senderName ?? (b.className ? `To ${b.className}${b.armName ? ` ${b.armName}` : ""}` : "To all students")} · {formatDate(b.createdAt)}</p>
                  </div>
                  {role === "student" && !b.readAt && <Button size="sm" variant="outline" onClick={async () => { await markBroadcastRead(b.id).catch(() => undefined); broadcasts.reload(); }}>Mark read</Button>}
                  {b.recipientCount !== undefined && <span className="text-xs text-slate-400">{b.readCount}/{b.recipientCount} read</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{b.body}</p>
              </Panel>
            ))}
          </div>
        )
      ) : list.loading ? <LoadingSkeleton count={4} /> : list.error || !list.data ? <ErrorState message={list.error ?? undefined} onRetry={list.reload} /> : list.data.length === 0 ? (
        <EmptyState icon={Mail} title={tab === "inbox" ? "Your inbox is empty" : "Nothing sent yet"} description="Messages will appear here." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {list.data.map((m) => {
              const person = tab === "inbox" ? m.senderName : m.recipientName;
              return (
                <li key={m.id}>
                  <button onClick={() => openMessage(m, tab === "sent")} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
                    <Avatar name={person ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${tab === "inbox" && m.status === "SENT" ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{person} — {m.subject || "(no subject)"}</p>
                      <p className="truncate text-xs text-slate-500">{m.body}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatDate(m.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog isOpen={compose !== null} onClose={() => setCompose(null)} title={compose?.parentId ? "Reply" : "New message"} maxWidth="lg">
        {compose && (
          <form onSubmit={send} className="space-y-4">
            {!compose.parentId && (
              <Select label="To" required value={compose.recipientId} onChange={(e) => setCompose({ ...compose, recipientId: e.target.value })}>
                <option value="" disabled>Choose a recipient</option>
                {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.fullName} — {ROLE_LABELS[c.role as UserRole] ?? c.role}</option>)}
              </Select>
            )}
            <Input label="Subject" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
            <Textarea label="Message" required value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCompose(null)}>Cancel</Button><Button type="submit" isLoading={busy}>Send</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={bcast !== null} onClose={() => setBcast(null)} title="Announce to students" description="Students can read announcements but cannot reply." maxWidth="lg">
        {bcast && (
          <form onSubmit={broadcast} className="space-y-4">
            <Select label="Audience" value={bcast.classId} onChange={(e) => setBcast({ ...bcast, classId: e.target.value })}>
              {(role === "owner" || role === "admin") && <option value="">Whole school</option>}
              {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Subject" value={bcast.subject} onChange={(e) => setBcast({ ...bcast, subject: e.target.value })} />
            <Textarea label="Announcement" required value={bcast.body} onChange={(e) => setBcast({ ...bcast, body: e.target.value })} />
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setBcast(null)}>Cancel</Button><Button type="submit" isLoading={busy}>Send announcement</Button></div>
          </form>
        )}
      </Dialog>

      <Dialog isOpen={thread !== null} onClose={() => setThread(null)} title={thread?.root.subject || "Conversation"} maxWidth="lg">
        {thread && (
          <div className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {thread.messages.map((m) => (
                <div key={m.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-700">{m.senderName} <span className="font-normal text-slate-400">· {formatDate(m.createdAt)}</span></p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.body}</p>
                </div>
              ))}
            </div>
            {canWrite && (() => {
              const last = thread.messages[thread.messages.length - 1];
              const other = last && last.senderId === thread.root.senderId ? (last.recipientId ?? "") : (last?.senderId ?? "");
              return <Button variant="outline" onClick={() => setCompose({ recipientId: other, subject: thread.root.subject ? `Re: ${thread.root.subject.replace(/^Re: /, "")}` : "", body: "", parentId: thread.root.parentId ?? thread.root.id })}><Reply className="mr-2 h-4 w-4" /> Reply</Button>;
            })()}
          </div>
        )}
      </Dialog>
    </AppShell>
  );
}
