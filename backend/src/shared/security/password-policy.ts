import { z } from "zod";

/** 8–72 chars (bcrypt truncates beyond 72 bytes), at least one letter and one number. */
export const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), "Password must contain a letter and a number.");
