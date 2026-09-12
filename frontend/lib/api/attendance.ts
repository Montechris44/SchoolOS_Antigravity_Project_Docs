import { AttendanceRecord, AttendanceStatus } from "@/types";
import { apiRequest } from "./client";

export function listAttendance(classId: string, date: string): Promise<AttendanceRecord[]> {
  return apiRequest<AttendanceRecord[]>(
    `/attendance?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
  );
}

export interface MarkAttendancePayload {
  classId: string;
  date: string;
  records: Array<{ studentId: string; status: AttendanceStatus; notes?: string }>;
}

export function markAttendance(payload: MarkAttendancePayload): Promise<AttendanceRecord[]> {
  return apiRequest<AttendanceRecord[]>("/attendance", { method: "POST", body: payload });
}
