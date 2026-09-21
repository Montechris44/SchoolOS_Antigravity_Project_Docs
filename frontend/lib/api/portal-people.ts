import { Credentials, StaffMember, StudentRecord } from "@/types/portal";
import { apiRequest, apiUpload } from "./client";

const qs = (params: Record<string, string | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(entries as [string, string][]).toString()}` : "";
};

// ---- Staff -----------------------------------------------------------------------
export interface CreateStaffBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: "admin" | "bursar" | "teacher" | "non_academic";
  title?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  dateOfBirth?: string;
  joinDate?: string;
  department?: string;
  qualification?: string;
  yearsOfExperience?: number;
  classTeacherArmId?: string;
  classTeacherClassId?: string;
}

export const listStaffMembers = (params: { role?: string; search?: string } = {}) => apiRequest<StaffMember[]>(`/staff${qs(params)}`);
export const getStaffMember = (userId: string) => apiRequest<StaffMember>(`/staff/${userId}`);
export const createStaffMember = (body: CreateStaffBody) => apiRequest<StaffMember>("/staff", { method: "POST", body });
export const updateStaffMember = (userId: string, body: Partial<CreateStaffBody> & { employeeId?: string }) =>
  apiRequest<StaffMember>(`/staff/${userId}`, { method: "PATCH", body });
export const toggleStaffMember = (userId: string) => apiRequest<StaffMember>(`/staff/${userId}/toggle`, { method: "PATCH" });
export const deleteStaffMember = (userId: string) => apiRequest(`/staff/${userId}`, { method: "DELETE" });
export const resetStaffPassword = (userId: string) => apiRequest<{ temporaryPassword: string }>(`/staff/${userId}/reset-password`, { method: "POST" });
export const getStaffSchedule = (userId: string) =>
  apiRequest<{
    staff: StaffMember;
    scheduleType: "academic" | "duty";
    entries: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; room: string | null; label: string }>;
    metrics: Record<string, string | number | null>;
  }>(`/staff/${userId}/schedule`);

// ---- Students -----------------------------------------------------------------------
export interface CreateStudentBody {
  admissionNumber?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: "male" | "female";
  dateOfBirth?: string;
  classId: string;
  armId?: string | null;
  address?: string;
  bloodGroup?: string;
  genotype?: string;
  createLogin?: boolean;
  guardian?: { firstName: string; lastName: string; relationship: "father" | "mother" | "guardian" | "other"; phone: string; email: string; address?: string };
}

export type StudentWithCredentials = StudentRecord & { credentials: Credentials | null };

export const listStudentRecords = (params: { classId?: string; armId?: string; status?: string; search?: string } = {}) =>
  apiRequest<StudentRecord[]>(`/students${qs(params)}`);
export const getStudentRecord = (id: string) => apiRequest<StudentRecord>(`/students/${id}`);
export const enrollStudent = (body: CreateStudentBody) => apiRequest<StudentWithCredentials>("/students", { method: "POST", body });
export const bulkImportStudents = (students: CreateStudentBody[]) =>
  apiRequest<{ success: Array<{ index: number; student: StudentRecord; credentials: Credentials | null }>; failed: Array<{ index: number; error: string }> }>(
    "/students/bulk-import",
    { method: "POST", body: { students } }
  );
export const updateStudentRecord = (id: string, body: Record<string, unknown>) => apiRequest<StudentRecord>(`/students/${id}`, { method: "PATCH", body });
export const resetStudentPassword = (id: string) => apiRequest<{ temporaryPassword: string }>(`/students/${id}/reset-password`, { method: "POST" });
export const createStudentPortalAccount = (id: string) => apiRequest<Credentials>(`/students/${id}/portal-account`, { method: "POST" });
export const uploadStudentPhoto = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<{ photoUrl: string }>(`/students/${id}/photo`, form);
};
export const getStudentSummary = (id: string) =>
  apiRequest<{
    student: StudentRecord;
    attendance: { totalDays: number; presentDays: number; lateDays: number; absentDays: number; attendancePercentage: number };
    metrics: { averageScore: number; subjectsGraded: number };
    currentTerm: { id: string; name: string } | null;
    subjectGrades: Array<{ subjectName: string; totalScore: number; grade: string; remark: string | null }>;
  }>(`/students/${id}/academic-summary`);

export const createGuardianAccount = (guardianId: string) => apiRequest<Credentials>(`/guardians/${guardianId}/portal-account`, { method: "POST" });
