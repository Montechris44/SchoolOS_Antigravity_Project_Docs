import { z } from "zod";

export const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;

export const schoolIdParamsSchema = z.object({
  schoolId: z.string().uuid(),
});

export const updateSchoolStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().max(500).optional(),
});

export type UpdateSchoolStatusInput = z.infer<typeof updateSchoolStatusSchema>;

export const listSchoolsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  search: z.string().max(200).optional(),
});

export const listUsersQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
});

export const listAuditLogsQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export const profileIdParamsSchema = z.object({
  profileId: z.string().uuid(),
});
