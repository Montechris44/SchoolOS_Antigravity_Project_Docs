import { apiRequest } from "./client";

export interface ChatResult {
  answer: string;
  toolExecuted: string | null;
  toolSuccess: boolean | null;
}

export function sendChatMessage(prompt: string): Promise<ChatResult> {
  return apiRequest<ChatResult>("/ai/chat", { method: "POST", body: { prompt } });
}
