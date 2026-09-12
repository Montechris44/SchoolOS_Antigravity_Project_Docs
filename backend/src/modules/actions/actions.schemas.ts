import { z } from "zod";

export const createActionSchema = z.object({
  title: z.string().min(1).max(200),
  recommendedStep: z.string().min(1).max(1000),
  priority: z.enum(["P0", "P1", "P2"]),
  notes: z.string().max(1000).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;

export const updateActionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
  outcome: z.string().max(1000).optional(),
});

export type UpdateActionInput = z.infer<typeof updateActionSchema>;

export const actionIdParamsSchema = z.object({
  actionId: z.string().uuid(),
});
