import { Staff } from "@/types";
import { apiRequest } from "./client";

export function listStaff(): Promise<Staff[]> {
  return apiRequest<Staff[]>("/staff");
}
