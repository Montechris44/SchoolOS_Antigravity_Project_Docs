"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { sendChatMessage } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  ShieldCheck,
  Cpu,
  CornerDownLeft,
  Bot,
  User,
  Database,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolExecuted?: string | null;
  toolSuccess?: boolean | null;
}

export default function AIAssistantPage() {
  const { user, school, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hello ${user?.fullName}. I am your SchoolOS Operational Intelligence Assistant. I am connected directly to ${school?.name}'s live academic, financial, and attendance records through authenticated server-side tools. How can I assist your school leadership today?`,
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (queryText?: string) => {
    const query = queryText || prompt;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setIsLoading(true);

    try {
      const data = await sendChatMessage(query);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "Unable to retrieve response.",
          toolExecuted: data.toolExecuted,
          toolSuccess: data.toolSuccess,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error connecting to AI Gateway: ${err instanceof ApiError ? err.message : "Unknown error."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "How is my school doing?",
    "Which students have attendance risks?",
    "Show me overdue fee balances",
    "Draft a fee reminder for Femi Williams",
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-gradient-to-tr from-brand to-brand-strong p-2 text-white shadow-md shadow-brand/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold font-heading tracking-tight text-slate-900">
                SchoolOS AI Intelligence Gateway
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Grounded in authoritative data • Strictly permission-checked • Zero hallucinations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand bg-brand-soft/70 border border-brand/20 px-3.5 py-1.5 rounded-xl">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Authorized as {role.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Chat History Window */}
        <div className="min-h-[480px] max-h-[600px] flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-elevated">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand shadow-2xs mt-0.5">
                    <Bot className="h-5 w-5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-5 py-4 max-w-2xl leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand text-white rounded-tr-xs shadow-subtle"
                      : "bg-slate-50/90 text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-2xs"
                  }`}
                >
                  {/* Tool Pill if executed */}
                  {m.toolExecuted && (
                    <div className="mb-3 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          m.toolSuccess
                            ? "bg-brand-soft text-brand border border-brand/20"
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        <Cpu className="h-3 w-3" />
                        Executed: {m.toolExecuted}()
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        • Verified Grounding
                      </span>
                    </div>
                  )}

                  <div className="whitespace-pre-line text-sm">{m.content}</div>
                </div>

                {m.role === "user" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs mt-0.5 font-bold text-xs font-mono">
                    {user?.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 text-sm justify-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand animate-pulse">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="rounded-2xl bg-slate-50 px-5 py-4 border border-slate-200/80 text-slate-500 text-xs flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-brand animate-bounce [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-brand animate-bounce [animation-delay:0.4s]" />
                  Executing authorized tool query...
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-3 bg-slate-50/70 border-t border-slate-200/70 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-2">
              Suggested Queries:
            </span>
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(qp)}
                className="text-xs font-semibold bg-white text-slate-700 hover:text-brand hover:border-brand/40 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:shadow-subtle"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Prompt Input Form */}
          <div className="p-4 bg-white border-t border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                placeholder="Ask about attendance trends, fee collection, student records, or notice drafts..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
              <Button
                type="submit"
                isLoading={isLoading}
                className="h-12 px-5 text-white shrink-0 gap-1.5"
              >
                <span>Ask</span> <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
