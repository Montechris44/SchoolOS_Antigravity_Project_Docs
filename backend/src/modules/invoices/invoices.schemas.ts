import { z } from "zod";

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  termId: z.string().uuid().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const listInvoicesQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
});
