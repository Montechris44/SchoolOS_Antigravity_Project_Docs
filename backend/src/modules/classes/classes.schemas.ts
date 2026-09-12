import { z } from "zod";

export const createClassSchema = z.object({
  name: z.string().min(1).max(120),
  gradeLevel: z.string().min(1).max(60),
  capacity: z.number().int().positive().max(500).default(40),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const classIdParamsSchema = z.object({
  classId: z.string().uuid(),
});
