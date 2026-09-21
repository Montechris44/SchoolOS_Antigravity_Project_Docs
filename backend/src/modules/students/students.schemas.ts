import { z } from "zod";

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const guardianSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  relationship: z.enum(["father", "mother", "guardian", "other"]),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  address: z.string().max(500).optional(),
});

export const createStudentSchema = z.object({
  /** Optional: generated as {SCHOOLCODE}/{year}/{sequence} when omitted. */
  admissionNumber: z.string().min(1).max(60).optional(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  middleName: z.string().max(120).optional(),
  gender: z.enum(["male", "female"]),
  dateOfBirth: date.optional(),
  classId: z.string().uuid(),
  armId: z.string().uuid().nullish(),
  enrollmentStatus: z.enum(["active", "graduated", "transferred", "suspended"]).default("active"),
  enrolledDate: date.optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.string().max(10).optional(),
  genotype: z.string().max(10).optional(),
  guardian: guardianSchema.optional(),
  /** Create the student's own sign-in account (default). */
  createLogin: z.boolean().default(true),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  middleName: z.string().max(120).nullable().optional(),
  gender: z.enum(["male", "female"]).optional(),
  dateOfBirth: date.nullable().optional(),
  classId: z.string().uuid().optional(),
  armId: z.string().uuid().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bloodGroup: z.string().max(10).nullable().optional(),
  genotype: z.string().max(10).nullable().optional(),
  enrollmentStatus: z.enum(["active", "graduated", "transferred", "suspended"]).optional(),
  guardian: guardianSchema.optional(),
});

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const bulkImportSchema = z.object({
  students: z.array(createStudentSchema).min(1).max(300),
});

export const listStudentsQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  armId: z.string().uuid().optional(),
  status: z.enum(["active", "graduated", "transferred", "suspended"]).optional(),
  search: z.string().max(100).optional(),
});

export const studentIdParamsSchema = z.object({
  studentId: z.string().uuid(),
});
