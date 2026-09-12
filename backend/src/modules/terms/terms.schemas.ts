import { z } from "zod";

export const createTermSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.enum(["First Term", "Second Term", "Third Term"]),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  isCurrent: z.boolean().default(false),
});

export type CreateTermInput = z.infer<typeof createTermSchema>;

export const listTermsQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
});
