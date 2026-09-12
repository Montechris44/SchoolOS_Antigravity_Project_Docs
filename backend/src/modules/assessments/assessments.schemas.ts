import { z } from "zod";

export const createAssessmentSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  type: z.enum(["CA1", "CA2", "EXAM", "PROJECT"]),
  maxScore: z.number().positive().max(1000).default(100),
  weightPercentage: z.number().positive().max(100).default(100),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const listAssessmentsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
});
