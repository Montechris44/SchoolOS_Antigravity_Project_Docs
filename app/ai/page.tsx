"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          schoolId: school?.id,
          userId: user?.id,
          role,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "Unable to retrieve response.",
          toolExecuted: data.toolExecuted,
          toolSuccess: data.toolSuccess,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error connecting to AI Gateway: ${err.message}`,
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-purple-600 p-2 text-white shadow-md shadow-purple-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                SchoolOS AI Intelligence Gateway
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Grounded in authoritative data • Strictly permission-checked • Zero hallucinations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              Authorized as {role.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Chat History Window */}
        <Card className="min-h-[460px] max-h-[560px] flex flex-col justify-between overflow-hidden border-slate-200 shadow-sm">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shadow-xs mt-0.5">
                    <Bot className="h-5 w-5" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-5 py-4 max-w-2xl leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                      : "bg-slate-50 text-slate-800 border border-slate-200/80 rounded-bl-none"
                  }`}
                >
                  {/* Tool Pill if executed */}
                  {m.toolExecuted && (
                    <div className="mb-3 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          m.toolSuccess
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-xs mt-0.5 font-bold text-xs">
                    {user?.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 text-sm justify-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 animate-pulse">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="rounded-2xl bg-slate-50 px-5 py-4 border border-slate-200/80 text-slate-500 text-xs flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-600 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
                  Executing authorized tool query...
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-2">
              Suggested Questions:
            </span>
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(qp)}
                className="text-xs font-semibold bg-white text-slate-700 hover:text-blue-700 hover:border-blue-300 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
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
              <Input
                placeholder="Ask about attendance trends, fees, performance, or drafting notices..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-12 text-sm bg-slate-50 border-slate-200 focus-visible:ring-purple-600"
              />
              <Button
                type="submit"
                isLoading={isLoading}
                className="h-12 px-5 bg-purple-600 hover:bg-purple-700 text-white shrink-0 gap-1.5"
              >
                <span>Ask</span> <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
