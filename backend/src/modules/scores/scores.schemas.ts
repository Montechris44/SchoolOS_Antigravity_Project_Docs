import { z } from "zod";

export const listScoresQuerySchema = z.object({
  assessmentId: z.string().uuid(),
});

export const recordScoresSchema = z.object({
  assessmentId: z.string().uuid(),
  scores: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        scoreObtained: z.number().min(0),
      })
    )
    .min(1),
});

export type RecordScoresInput = z.infer<typeof recordScoresSchema>;
