import { FeeStructure, Invoice } from "@/types";
import { apiRequest } from "./client";

export function listFeeStructures(): Promise<FeeStructure[]> {
  return apiRequest<FeeStructure[]>("/fee-structures");
}

export interface CreateInvoicePayload {
  studentId: string;
  description: string;
  amount: number;
  dueDate: string;
}

export function listInvoices(studentId?: string): Promise<Invoice[]> {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
  return apiRequest<Invoice[]>(`/invoices${query}`);
}

export function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  return apiRequest<Invoice>("/invoices", { method: "POST", body: payload });
}
