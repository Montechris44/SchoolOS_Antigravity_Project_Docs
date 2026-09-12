import { z } from "zod";

export const registerSchoolSchema = z.object({
  school: z.object({
    name: z.string().min(2).max(200),
    address: z.string().min(2).max(500),
    city: z.string().min(2).max(120),
    state: z.string().min(2).max(120),
    country: z.string().min(2).max(120).default("Nigeria"),
    phone: z.string().min(7).max(30),
    email: z.string().email(),
    currency: z.string().length(3).default("NGN"),
    logoUrl: z.string().url().optional(),
  }),
  owner: z.object({
    fullName: z.string().min(2).max(200),
    email: z.string().email(),
    phone: z.string().min(7).max(30).optional(),
    password: z.string().min(8).max(72),
  }),
});

export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
