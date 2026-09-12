import { ActionPriority, ActionStatus, SchoolAction } from "@/types";
import { apiRequest } from "./client";

export function listActions(): Promise<SchoolAction[]> {
  return apiRequest<SchoolAction[]>("/actions");
}

export interface CreateActionPayload {
  title: string;
  recommendedStep: string;
  priority: ActionPriority;
  notes?: string;
}

export function createAction(payload: CreateActionPayload): Promise<SchoolAction> {
  return apiRequest<SchoolAction>("/actions", { method: "POST", body: payload });
}

export function updateActionStatus(
  actionId: string,
  status: ActionStatus,
  outcome?: string
): Promise<SchoolAction> {
  return apiRequest<SchoolAction>(`/actions/${actionId}`, { method: "PATCH", body: { status, outcome } });
}
