import { Announcement } from "@/types";
import { apiRequest } from "./client";

export function listAnnouncements(): Promise<Announcement[]> {
  return apiRequest<Announcement[]>("/announcements");
}

export interface DispatchAnnouncementPayload {
  title: string;
  body: string;
  channels: Array<"whatsapp" | "sms" | "in_app">;
  targetAudience: "all" | "parents" | "teachers" | "class";
  targetClassId?: string;
}

export function dispatchAnnouncement(payload: DispatchAnnouncementPayload): Promise<Announcement> {
  return apiRequest<Announcement>("/announcements", { method: "POST", body: payload });
}
