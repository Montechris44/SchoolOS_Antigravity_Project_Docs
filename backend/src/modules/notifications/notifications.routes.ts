import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { validateParams, validateQuery } from "../../shared/validation/validate";

const listSchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const idSchema = z.object({ notificationId: z.string().uuid() });

const guard = { preHandler: authenticate };

/** A user only ever sees their own notifications, scoped to their school. */
export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/notifications", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { unread, limit } = validateQuery(request, listSchema);
    const result = await query(
      `SELECT id, type, title, message, entity_type, entity_id, read_at, created_at
       FROM notifications
       WHERE school_id = $1 AND user_id = $2 AND ($3::boolean IS NOT TRUE OR read_at IS NULL)
       ORDER BY created_at DESC LIMIT $4`,
      [actor.schoolId, actor.userId, unread === "true", limit]
    );
    reply.send(ok(toCamelCase(result.rows)));
  });

  app.get("/notifications/unread-count", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const result = await query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM notifications WHERE school_id = $1 AND user_id = $2 AND read_at IS NULL",
      [actor.schoolId, actor.userId]
    );
    reply.send(ok({ unread: result.rows[0].n }));
  });

  app.patch("/notifications/read-all", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const result = await query("UPDATE notifications SET read_at = NOW() WHERE school_id = $1 AND user_id = $2 AND read_at IS NULL", [
      actor.schoolId,
      actor.userId,
    ]);
    reply.send(ok({ updated: result.rowCount }));
  });

  app.patch("/notifications/:notificationId/read", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { notificationId } = validateParams(request, idSchema);
    await query("UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND school_id = $2 AND user_id = $3", [
      notificationId,
      actor.schoolId,
      actor.userId,
    ]);
    reply.send(ok({ read: true }));
  });
}
