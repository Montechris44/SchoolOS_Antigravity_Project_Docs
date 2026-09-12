import { Student } from "@/types";
import { apiRequest } from "./client";

export interface CreateStudentPayload {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: "male" | "female";
  dateOfBirth: string;
  classId: string;
  enrollmentStatus?: "active" | "graduated" | "transferred" | "suspended";
  enrolledDate?: string;
  guardian?: {
    firstName: string;
    lastName: string;
    relationship: "father" | "mother" | "guardian" | "other";
    phone: string;
    email: string;
    address?: string;
  };
}

export function listStudents(classId?: string): Promise<Student[]> {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  return apiRequest<Student[]>(`/students${query}`);
}

export function createStudent(payload: CreateStudentPayload): Promise<Student> {
  return apiRequest<Student>("/students", { method: "POST", body: payload });
}
