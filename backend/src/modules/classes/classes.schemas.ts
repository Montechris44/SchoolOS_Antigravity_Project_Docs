import { z } from "zod";

export const createClassSchema = z.object({
  name: z.string().min(1).max(120),
  gradeLevel: z.string().min(1).max(60),
  capacity: z.number().int().positive().max(500).default(40),
  level: z.number().int().min(0).max(30).optional(),
  description: z.string().max(500).optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const classIdParamsSchema = z.object({
  classId: z.string().uuid(),
});

export const armIdParamsSchema = z.object({
  armId: z.string().uuid(),
});

export const createArmSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().positive().max(500).default(40),
});

export const updateArmSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().max(500).optional(),
});

export const assignClassTeacherSchema = z.object({
  teacherId: z.string().uuid(),
});
