import { SchoolClass } from "@/types";
import { apiRequest } from "./client";

export interface CreateClassPayload {
  name: string;
  gradeLevel: string;
  capacity: number;
}

export function listClasses(): Promise<SchoolClass[]> {
  return apiRequest<SchoolClass[]>("/classes");
}

export function createClass(payload: CreateClassPayload): Promise<SchoolClass> {
  return apiRequest<SchoolClass>("/classes", { method: "POST", body: payload });
}
