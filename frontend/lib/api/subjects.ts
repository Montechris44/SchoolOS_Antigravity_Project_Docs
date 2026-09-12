import { Subject } from "@/types";
import { apiRequest } from "./client";

export interface CreateSubjectPayload {
  name: string;
  code: string;
}

export function listSubjects(): Promise<Subject[]> {
  return apiRequest<Subject[]>("/subjects");
}

export function createSubject(payload: CreateSubjectPayload): Promise<Subject> {
  return apiRequest<Subject>("/subjects", { method: "POST", body: payload });
}
