import { z } from "zod";

export const schoolIdParamsSchema = z.object({
  schoolId: z.string().uuid(),
});

export const updateSchoolSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  logoUrl: z.string().url().optional(),
  address: z.string().min(2).max(500).optional(),
  city: z.string().min(2).max(120).optional(),
  state: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(30).optional(),
  email: z.string().email().optional(),
  currency: z.string().length(3).optional(),
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
