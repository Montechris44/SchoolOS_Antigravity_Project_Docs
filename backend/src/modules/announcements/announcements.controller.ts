import { FastifyReply, FastifyRequest } from "fastify";

import { getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody } from "../../shared/validation/validate";
import { dispatchAnnouncement, listAnnouncements } from "./announcements.service";
import { dispatchAnnouncementSchema } from "./announcements.schemas";

export async function listAnnouncementsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "communication:send");

  const announcements = await listAnnouncements(actor.schoolId);
  reply.status(200).send(ok(toCamelCase(announcements)));
}

export async function dispatchAnnouncementHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "communication:send");

  const input = validateBody(request, dispatchAnnouncementSchema);
  const announcement = await dispatchAnnouncement(actor.schoolId, actor.userId, input);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "announcement.dispatched",
    resourceType: "announcement",
    resourceId: announcement.id,
  });

  reply.status(201).send(created(toCamelCase(announcement)));
}
