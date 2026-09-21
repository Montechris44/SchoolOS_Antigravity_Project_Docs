import { z } from "zod";

import { newPasswordSchema } from "../../shared/security/password-policy";

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const STAFF_ROLES = ["admin", "bursar", "teacher", "non_academic"] as const;

export const createStaffSchema = z.object({
  employeeId: z.string().min(1).max(60).optional(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(30).optional(),
  role: z.enum(STAFF_ROLES),
  title: z.string().min(1).max(120).optional(),
  /** Optional: when omitted a random temporary password is generated. Either way the user must change it on first sign-in. */
  password: newPasswordSchema.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().max(500).optional(),
  dateOfBirth: date.optional(),
  joinDate: date.optional(),
  department: z.string().max(100).optional(),
  qualification: z.string().max(100).optional(),
  yearsOfExperience: z.number().int().min(0).max(70).optional(),
  classTeacherArmId: z.string().uuid().optional(),
  classTeacherClassId: z.string().uuid().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  title: z.string().min(1).max(120).optional(),
  employeeId: z.string().min(1).max(60).optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  dateOfBirth: date.nullable().optional(),
  joinDate: date.nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  qualification: z.string().max(100).nullable().optional(),
  yearsOfExperience: z.number().int().min(0).max(70).nullable().optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const staffIdParamsSchema = z.object({ userId: z.string().uuid() });
