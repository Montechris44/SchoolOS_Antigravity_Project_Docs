import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
