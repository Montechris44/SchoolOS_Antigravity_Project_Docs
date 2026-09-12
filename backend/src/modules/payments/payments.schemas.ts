import { z } from "zod";

export const recordManualPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["bank_transfer", "pos", "cash"]),
  payerName: z.string().min(1).max(200),
  payerEmail: z.string().email().optional(),
  payerPhone: z.string().max(30).optional(),
});

export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>;

export const initializePaystackSchema = z.object({
  invoiceId: z.string().uuid(),
  amountInNaira: z.number().positive(),
  email: z.string().email(),
  callbackUrl: z.string().url().optional(),
});

export type InitializePaystackInput = z.infer<typeof initializePaystackSchema>;
