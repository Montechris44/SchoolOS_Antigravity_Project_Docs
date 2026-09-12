import { IntelligenceSignal, SchoolHealthScore } from "@/types";
import { apiRequest } from "./client";

export function listSignals(): Promise<IntelligenceSignal[]> {
  return apiRequest<IntelligenceSignal[]>("/intelligence/signals");
}

export function getSchoolHealth(): Promise<SchoolHealthScore> {
  return apiRequest<SchoolHealthScore>("/intelligence/health");
}
