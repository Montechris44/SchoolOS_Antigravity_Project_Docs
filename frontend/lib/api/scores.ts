import { Score } from "@/types";
import { apiRequest } from "./client";

export function listScores(assessmentId: string): Promise<Score[]> {
  return apiRequest<Score[]>(`/scores?assessmentId=${encodeURIComponent(assessmentId)}`);
}

export interface RecordScoresPayload {
  assessmentId: string;
  scores: Array<{ studentId: string; scoreObtained: number }>;
}

export function recordScores(payload: RecordScoresPayload): Promise<Score[]> {
  return apiRequest<Score[]>("/scores", { method: "POST", body: payload });
}
