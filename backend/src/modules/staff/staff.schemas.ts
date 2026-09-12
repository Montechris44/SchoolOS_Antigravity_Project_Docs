import { z } from "zod";

export const createStaffSchema = z.object({
  employeeId: z.string().min(1).max(60),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  role: z.enum(["admin", "bursar", "teacher"]),
  title: z.string().min(1).max(120),
  password: z.string().min(8).max(72),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
