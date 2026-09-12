import { Assessment } from "@/types";
import { apiRequest } from "./client";

export interface CreateAssessmentPayload {
  classId: string;
  subjectId: string;
  termId?: string;
  name: string;
  type: "CA1" | "CA2" | "EXAM" | "PROJECT";
  maxScore: number;
  weightPercentage: number;
}

export function listAssessments(classId?: string, subjectId?: string): Promise<Assessment[]> {
  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (subjectId) params.set("subjectId", subjectId);
  const query = params.toString();
  return apiRequest<Assessment[]>(`/assessments${query ? `?${query}` : ""}`);
}

export function createAssessment(payload: CreateAssessmentPayload): Promise<Assessment> {
  return apiRequest<Assessment>("/assessments", { method: "POST", body: payload });
}
