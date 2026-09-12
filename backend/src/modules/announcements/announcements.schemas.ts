import { z } from "zod";

export const dispatchAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  channels: z.array(z.enum(["whatsapp", "sms", "in_app"])).min(1),
  targetAudience: z.enum(["all", "parents", "teachers", "class"]),
  targetClassId: z.string().uuid().optional(),
});

export type DispatchAnnouncementInput = z.infer<typeof dispatchAnnouncementSchema>;
