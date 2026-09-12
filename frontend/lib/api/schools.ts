import { School } from "@/types";
import { apiRequest } from "./client";

export interface UpdateSchoolPayload {
  name?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  currency?: string;
}

export function updateSchool(schoolId: string, payload: UpdateSchoolPayload): Promise<School> {
  return apiRequest<School>(`/schools/${schoolId}`, { method: "PATCH", body: payload });
}
