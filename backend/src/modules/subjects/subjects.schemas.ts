import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().min(1).max(20).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const subjectIdParamsSchema = z.object({ subjectId: z.string().uuid() });

export const fromCatalogSchema = z.object({
  globalSubjectIds: z.array(z.string().uuid()).min(1).max(100),
});
