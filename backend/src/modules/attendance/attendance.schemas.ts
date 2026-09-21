import { z } from "zod";

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const uuid = z.string().uuid();

export const listAttendanceQuerySchema = z.object({
  classId: uuid,
  armId: uuid.optional(),
  date,
});

export const markAttendanceSchema = z.object({
  classId: uuid,
  armId: uuid.nullish(),
  date,
  records: z
    .array(
      z.object({
        studentId: uuid,
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(500),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const overviewQuerySchema = z.object({
  date: date.optional(),
  from: date.optional(),
  to: date.optional(),
  classId: uuid.optional(),
  armId: uuid.optional(),
  studentId: uuid.optional(),
});

export const historyQuerySchema = z.object({
  from: date.optional(),
  to: date.optional(),
});
