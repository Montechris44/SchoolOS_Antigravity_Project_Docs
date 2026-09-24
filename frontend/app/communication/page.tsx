"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listAnnouncements, dispatchAnnouncement } from "@/lib/api/communication";
import { ApiError } from "@/lib/api/client";
import { Announcement } from "@/types";
import { SYSTEM_TEMPLATES } from "@/modules/communication/messaging-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { formatDate } from "@/lib/utils";
import {
  Megaphone,
  Send,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Plus,
} from "lucide-react";

export default function CommunicationPage() {
  const { school } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeTab, setActiveTab] = useState<"broadcasts" | "templates">("broadcasts");
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<Array<"whatsapp" | "sms" | "in_app">>(["whatsapp", "sms"]);
  const [audience, setAudience] = useState<"all" | "parents" | "teachers">("parents");
  const [isSending, setIsSending] = useState(false);
  const [sendErrorMsg, setSendErrorMsg] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const refreshAnnouncements = () => {
    if (!school) return;
    setLoadError(null);
    listAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load announcements."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    refreshAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const toggleChannel = (ch: "whatsapp" | "sms" | "in_app") => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    setIsSending(true);
    setSendErrorMsg("");

    try {
      await dispatchAnnouncement({ title, body, channels, targetAudience: audience });
      refreshAnnouncements();
      setIsComposeModalOpen(false);
      setSuccessBanner(`Announcement '${title}' queued and dispatched to ${audience}!`);
      setTitle("");
      setBody("");
      setTimeout(() => setSuccessBanner(""), 4000);
    } catch (err) {
      setSendErrorMsg(err instanceof ApiError ? err.message : "Failed to dispatch announcement. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSkeleton count={5} />
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <ErrorState message={loadError} onRetry={refreshAnnouncements} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider mb-2">
              <Megaphone className="h-3.5 w-3.5" />
              Omni-Channel Outreach
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Communication &amp; Parent Broadcasts
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Deliver official updates, fee reminders, and attendance notifications via WhatsApp, SMS, and Portal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsComposeModalOpen(true)}
              className="gap-2 rounded-2xl bg-brand font-semibold text-white shadow-sm hover:bg-brand-strong transition-all duration-200"
            >
              <Plus className="h-4 w-4" /> Compose Broadcast
            </Button>
          </div>
        </div>

        {/* Success Alert */}
        {successBanner && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-2xs animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successBanner}
          </div>
        )}

        {/* Channel Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 p-5 flex items-center justify-between shadow-subtle hover:shadow-card-hover transition-all">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-emerald-600 text-white p-3 shadow-2xs">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm text-slate-900">WhatsApp Business</p>
                <p className="text-xs text-emerald-700 font-medium">Provider Adapter Connected</p>
              </div>
            </div>
            <Badge variant="success" className="font-bold">Online</Badge>
          </div>

          <div className="rounded-3xl border border-brand/20 bg-gradient-to-br from-brand-soft to-white p-5 flex items-center justify-between shadow-subtle hover:shadow-card-hover transition-all">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-brand text-white p-3 shadow-2xs">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm text-slate-900">Nigerian GSM Relay</p>
                <p className="text-xs text-slate-500 font-medium">MTN, Airtel, Glo, 9mobile</p>
              </div>
            </div>
            <Badge variant="default" className="bg-brand text-white font-bold">Online</Badge>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 flex items-center justify-between shadow-subtle hover:shadow-card-hover transition-all">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl bg-slate-100 text-slate-700 p-3">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm text-slate-900">Message Templates</p>
                <p className="text-xs text-slate-500 font-medium">{SYSTEM_TEMPLATES.length} pre-approved</p>
              </div>
            </div>
            <Badge variant="secondary" className="font-bold">Active</Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("broadcasts")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-heading font-bold transition-all ${
              activeTab === "broadcasts"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Megaphone className="h-4 w-4" /> Broadcast History ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-heading font-bold transition-all ${
              activeTab === "templates"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-4 w-4" /> Approved Templates ({SYSTEM_TEMPLATES.length})
          </button>
        </div>

        {/* Tab 1: Broadcasts History */}
        {activeTab === "broadcasts" && (
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <Card className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-subtle">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                  <Megaphone className="h-7 w-7" />
                </div>
                <h3 className="font-heading text-base font-bold text-slate-900">No broadcasts sent yet</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  Compose your first multi-channel announcement to notify parents and staff instantly.
                </p>
                <Button
                  onClick={() => setIsComposeModalOpen(true)}
                  className="mt-5 rounded-2xl bg-brand text-white font-semibold shadow-sm hover:bg-brand-strong"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Compose Broadcast
                </Button>
              </Card>
            ) : (
              announcements.map((anc) => (
                <Card key={anc.id} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-subtle hover:shadow-card-hover transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-heading font-bold text-base text-slate-900">{anc.title}</h3>
                      <Badge variant="success" className="font-semibold uppercase text-[10px]">{anc.status}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{anc.sentAt ? formatDate(anc.sentAt) : "Recently"}</span>
                    </div>
                  </div>

                  <p className="mt-3.5 text-sm text-slate-600 leading-relaxed">{anc.body}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-semibold">Channels:</span>
                      {anc.channels.map((ch) => (
                        <span key={ch} className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold uppercase text-[10px] text-slate-700 border border-slate-200/60">
                          {ch}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">
                        Recipients: <strong className="font-mono text-slate-800">{anc.recipientCount}</strong>
                      </span>
                      {anc.deliveryStats && (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                          ✓ {anc.deliveryStats.delivered} Delivered
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Tab 2: System Templates */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SYSTEM_TEMPLATES.map((tmpl) => (
              <Card key={tmpl.id} className="rounded-3xl border border-slate-200/80 bg-white p-6 flex flex-col justify-between shadow-subtle hover:shadow-card-hover transition-all">
                <div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="uppercase font-mono text-[10px] px-2.5 py-0.5">
                      {tmpl.channel}
                    </Badge>
                  </div>
                  <h4 className="font-heading font-bold text-base text-slate-900 mt-3">{tmpl.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{tmpl.subject}&rdquo;</p>
                  <div className="mt-3.5 rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100 text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
                    {tmpl.body}
                  </div>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs font-semibold rounded-xl hover:bg-brand-soft hover:text-brand hover:border-brand/40 transition-colors"
                    onClick={() => {
                      setTitle(tmpl.subject);
                      setBody(tmpl.body);
                      setIsComposeModalOpen(true);
                    }}
                  >
                    Use This Template
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modal: Compose Broadcast */}
        <Dialog
          isOpen={isComposeModalOpen}
          onClose={() => setIsComposeModalOpen(false)}
          title="Compose Multi-Channel Broadcast"
          description="Send urgent notices and reminders to parents, teachers or the entire school community."
          maxWidth="lg"
        >
          <form onSubmit={handleSendAnnouncement} className="space-y-4">
            {sendErrorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sendErrorMsg}
              </div>
            )}
            <Input
              id="broadcastTitle"
              label="Subject / Heading"
              placeholder="e.g. Mid-Term Assessment Schedule & Fee Notice"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="w-full space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Message Content
              </label>
              <textarea
                rows={4}
                required
                placeholder="Type your message text here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 transition-all shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-2">
                  Target Audience
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/20 shadow-2xs"
                >
                  <option value="parents">Parents / Guardians</option>
                  <option value="teachers">Teaching Staff</option>
                  <option value="all">Whole School Community</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-2">
                  Delivery Channels
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={channels.includes("whatsapp")}
                      onChange={() => toggleChannel("whatsapp")}
                      className="rounded-md border-slate-300 text-brand focus:ring-brand"
                    />
                    WhatsApp
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={channels.includes("sms")}
                      onChange={() => toggleChannel("sms")}
                      className="rounded-md border-slate-300 text-brand focus:ring-brand"
                    />
                    SMS
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" className="rounded-xl font-semibold" onClick={() => setIsComposeModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSending} className="gap-2 rounded-xl bg-brand text-white font-semibold shadow-sm hover:bg-brand-strong">
                <Send className="h-4 w-4" /> Dispatch Broadcast
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
