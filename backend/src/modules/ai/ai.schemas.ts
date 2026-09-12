import { z } from "zod";

export const chatSchema = z.object({
  prompt: z.string().min(1).max(1000),
});

export type ChatInput = z.infer<typeof chatSchema>;
