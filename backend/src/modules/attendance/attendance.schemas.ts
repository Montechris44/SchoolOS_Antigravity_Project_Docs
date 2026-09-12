import { z } from "zod";

export const listAttendanceQuerySchema = z.object({
  classId: z.string().uuid(),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
