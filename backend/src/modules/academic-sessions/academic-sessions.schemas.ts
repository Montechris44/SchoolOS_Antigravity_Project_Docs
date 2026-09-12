import { z } from "zod";

export const createAcademicSessionSchema = z.object({
  name: z.string().min(2).max(60),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  isCurrent: z.boolean().default(false),
});

export type CreateAcademicSessionInput = z.infer<typeof createAcademicSessionSchema>;
