import { z } from "zod";

export const createStudentSchema = z.object({
  admissionNumber: z.string().min(1).max(60),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  middleName: z.string().max(120).optional(),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  classId: z.string().uuid(),
  enrollmentStatus: z.enum(["active", "graduated", "transferred", "suspended"]).default("active"),
  enrolledDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .optional(),
  guardian: z
    .object({
      firstName: z.string().min(1).max(120),
      lastName: z.string().min(1).max(120),
      relationship: z.enum(["father", "mother", "guardian", "other"]),
      phone: z.string().min(7).max(30),
      email: z.string().email(),
      address: z.string().max(500).optional(),
    })
    .optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const listStudentsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
});

export const studentIdParamsSchema = z.object({
  studentId: z.string().uuid(),
});
