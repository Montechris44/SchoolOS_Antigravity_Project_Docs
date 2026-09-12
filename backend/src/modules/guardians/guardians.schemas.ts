import { z } from "zod";

export const createGuardianSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  relationship: z.enum(["father", "mother", "guardian", "other"]),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  address: z.string().max(500).optional(),
});

export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
