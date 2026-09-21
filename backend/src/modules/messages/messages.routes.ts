import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { UserRole, isAdminRole } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { notifyUser } from "../../shared/academics/notifications";
import { toCamelCase } from "../../shared/http/case";
import { ForbiddenError, NotFoundError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { paginate, paged } from "../../shared/http/pagination";
import { requireRole } from "../../shared/security/tenant-guard";
import { assertClassArm } from "../../shared/security/ownership";
import { assertTeachesClass } from "../../shared/academics/period";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";

const STAFF: UserRole[] = ["teacher", "bursar", "non_academic"];
const uuid = z.string().uuid();

/**
 * Who may write to whom (always inside one school):
 *  - administrators and staff message each other freely,
 *  - parents message administrators only,
 *  - students never send direct messages (they receive broadcasts).
 */
function messageableRoles(sender: UserRole): UserRole[] {
  if (isAdminRole(sender) || STAFF.includes(sender)) return ["owner", "admin", ...STAFF];
  if (sender === "parent") return ["owner", "admin"];
  return [];
}

const sendSchema = z.object({
  recipientId: uuid,
  subject: z.string().max(200).nullish(),
  body: z.string().min(1).max(5000),
  parentId: uuid.nullish(),
});
const broadcastSchema = z.object({
  subject: z.string().max(200).nullish(),
  body: z.string().min(1).max(5000),
  classId: uuid.nullish(),
  armId: uuid.nullish(),
});
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
const messageParams = z.object({ messageId: uuid });
const broadcastParams = z.object({ broadcastId: uuid });

const guard = { preHandler: authenticate };

export async function messagesRoutes(app: FastifyInstance): Promise<void> {
  app.post("/messages", { ...guard, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const input = validateBody(request, sendSchema);

    if (actor.role === "student") throw new ForbiddenError("Students cannot send messages; they can read broadcasts.");
    if (input.recipientId === actor.userId) throw new ForbiddenError("You cannot message yourself.");

    const recipient = await query<{ role: UserRole }>(
      "SELECT role FROM memberships WHERE school_id = $1 AND user_id = $2 AND is_active = TRUE",
      [actor.schoolId, input.recipientId]
    );
    if (recipient.rowCount === 0) throw new NotFoundError("Recipient not found.");
    if (!messageableRoles(actor.role).includes(recipient.rows[0].role)) {
      throw new ForbiddenError("You cannot send messages to that person.");
    }

    // A reply must continue a thread the sender is actually part of.
    if (input.parentId) {
      const thread = await query("SELECT 1 FROM messages WHERE id = $1 AND school_id = $2 AND (sender_id = $3 OR recipient_id = $3)", [
        input.parentId,
        actor.schoolId,
        actor.userId,
      ]);
      if (thread.rowCount === 0) throw new NotFoundError("The message you are replying to was not found.");
    }

    const message = await query<{ id: string }>(
      `INSERT INTO messages (school_id, sender_id, recipient_id, subject, body, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, subject, body, created_at`,
      [actor.schoolId, actor.userId, input.recipientId, input.subject ?? null, input.body, input.parentId ?? null]
    );
    await notifyUser(actor.schoolId, input.recipientId, {
      type: "MESSAGE_RECEIVED",
      title: input.subject || "New message",
      message: input.body.slice(0, 200),
      entityType: "message",
      entityId: message.rows[0].id,
    });
    reply.status(201).send(created(toCamelCase(message.rows[0])));
  });

  app.get("/messages/contacts", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const roles = messageableRoles(actor.role);
    if (roles.length === 0) return reply.send(ok([]));

    const contacts = await query(
      `SELECT p.id, p.full_name, p.email, m.role::text AS role
       FROM memberships m JOIN profiles p ON p.id = m.user_id
       WHERE m.school_id = $1 AND m.is_active = TRUE AND m.user_id <> $2 AND m.role::text = ANY($3::text[])
       ORDER BY m.role, p.full_name`,
      [actor.schoolId, actor.userId, roles]
    );
    return reply.send(ok(toCamelCase(contacts.rows)));
  });

  app.get("/messages/inbox", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { page, limit } = validateQuery(request, pageSchema);
    const { offset } = paginate(page, limit);

    const [rows, total] = await Promise.all([
      query(
        `SELECT m.id, m.subject, m.body, m.status, m.read_at, m.parent_id, m.created_at, m.sender_id,
                p.full_name AS sender_name, p.email AS sender_email
         FROM messages m JOIN profiles p ON p.id = m.sender_id
         WHERE m.school_id = $1 AND m.recipient_id = $2 AND m.status <> 'DELETED'
         ORDER BY m.created_at DESC LIMIT $3 OFFSET $4`,
        [actor.schoolId, actor.userId, limit, offset]
      ),
      query<{ n: number }>("SELECT COUNT(*)::int AS n FROM messages WHERE school_id = $1 AND recipient_id = $2 AND status <> 'DELETED'", [actor.schoolId, actor.userId]),
    ]);
    reply.send(paged(toCamelCase<unknown[]>(rows.rows), total.rows[0].n, page, limit));
  });

  app.get("/messages/sent", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { page, limit } = validateQuery(request, pageSchema);
    const { offset } = paginate(page, limit);

    const [rows, total] = await Promise.all([
      query(
        `SELECT m.id, m.subject, m.body, m.status, m.parent_id, m.created_at, m.recipient_id,
                p.full_name AS recipient_name, p.email AS recipient_email
         FROM messages m JOIN profiles p ON p.id = m.recipient_id
         WHERE m.school_id = $1 AND m.sender_id = $2 AND m.status <> 'DELETED'
         ORDER BY m.created_at DESC LIMIT $3 OFFSET $4`,
        [actor.schoolId, actor.userId, limit, offset]
      ),
      query<{ n: number }>("SELECT COUNT(*)::int AS n FROM messages WHERE school_id = $1 AND sender_id = $2 AND status <> 'DELETED'", [actor.schoolId, actor.userId]),
    ]);
    reply.send(paged(toCamelCase<unknown[]>(rows.rows), total.rows[0].n, page, limit));
  });

  app.get("/messages/unread-count", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const [direct, broadcasts] = await Promise.all([
      query<{ n: number }>("SELECT COUNT(*)::int AS n FROM messages WHERE school_id = $1 AND recipient_id = $2 AND status = 'SENT'", [actor.schoolId, actor.userId]),
      query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM message_broadcast_reads r JOIN message_broadcasts b ON b.id = r.broadcast_id
         WHERE b.school_id = $1 AND r.user_id = $2 AND r.read_at IS NULL`,
        [actor.schoolId, actor.userId]
      ),
    ]);
    reply.send(ok({ unread: direct.rows[0].n + broadcasts.rows[0].n }));
  });

  app.get("/messages/:messageId/thread", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { messageId } = validateParams(request, messageParams);
    const thread = await query(
      `SELECT m.id, m.subject, m.body, m.created_at, m.sender_id, m.recipient_id, p.full_name AS sender_name
       FROM messages m JOIN profiles p ON p.id = m.sender_id
       WHERE m.school_id = $1 AND (m.id = $2 OR m.parent_id = $2) AND (m.sender_id = $3 OR m.recipient_id = $3) AND m.status <> 'DELETED'
       ORDER BY m.created_at ASC`,
      [actor.schoolId, messageId, actor.userId]
    );
    reply.send(ok(toCamelCase(thread.rows)));
  });

  app.patch("/messages/:messageId/read", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { messageId } = validateParams(request, messageParams);
    await query("UPDATE messages SET status = 'READ', read_at = NOW() WHERE id = $1 AND school_id = $2 AND recipient_id = $3 AND status = 'SENT'", [
      messageId,
      actor.schoolId,
      actor.userId,
    ]);
    reply.send(ok({ read: true }));
  });

  app.delete("/messages/:messageId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { messageId } = validateParams(request, messageParams);
    await query("UPDATE messages SET status = 'DELETED' WHERE id = $1 AND school_id = $2 AND (sender_id = $3 OR recipient_id = $3)", [
      messageId,
      actor.schoolId,
      actor.userId,
    ]);
    reply.send(ok({ deleted: true }));
  });

  // ---- One-way announcements to students -----------------------------------------
  app.post("/messages/broadcast", { ...guard, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["owner", "admin", "teacher"]);
    const input = validateBody(request, broadcastSchema);

    if (input.classId) {
      await assertClassArm(actor.schoolId, input.classId, input.armId);
      await assertTeachesClass(actor, input.classId, input.armId);
    } else if (!isAdminRole(actor.role)) {
      throw new ForbiddenError("Teachers can only broadcast to a class they teach.");
    }

    const broadcast = await query<{ id: string }>(
      `INSERT INTO message_broadcasts (school_id, sender_id, subject, body, class_id, arm_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, subject, body, created_at`,
      [actor.schoolId, actor.userId, input.subject ?? null, input.body, input.classId ?? null, input.armId ?? null]
    );

    const recipients = await query<{ user_id: string }>(
      `INSERT INTO message_broadcast_reads (broadcast_id, user_id)
       SELECT $1, s.user_id FROM students s
       WHERE s.school_id = $2 AND s.enrollment_status = 'active' AND s.user_id IS NOT NULL
         AND ($3::uuid IS NULL OR s.current_class_id = $3) AND ($4::uuid IS NULL OR s.arm_id = $4)
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [broadcast.rows[0].id, actor.schoolId, input.classId ?? null, input.armId ?? null]
    );
    await query(
      `INSERT INTO notifications (school_id, user_id, type, title, message, entity_type, entity_id)
       SELECT $1, r.user_id, 'BROADCAST', $3, $4, 'message_broadcast', $2 FROM message_broadcast_reads r WHERE r.broadcast_id = $2`,
      [actor.schoolId, broadcast.rows[0].id, input.subject || "New announcement", input.body.slice(0, 200)]
    );
    reply.status(201).send(created({ ...toCamelCase<Record<string, unknown>>(broadcast.rows[0]), recipientCount: recipients.rowCount }));
  });

  app.get("/messages/broadcasts", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);

    // Staff who can send see what was sent (with reach); students see what was sent to them.
    if (actor.role === "student") {
      const mine = await query(
        `SELECT b.id, b.subject, b.body, b.created_at, p.full_name AS sender_name, r.read_at
         FROM message_broadcasts b JOIN message_broadcast_reads r ON r.broadcast_id = b.id AND r.user_id = $2
         LEFT JOIN profiles p ON p.id = b.sender_id
         WHERE b.school_id = $1 ORDER BY b.created_at DESC LIMIT 100`,
        [actor.schoolId, actor.userId]
      );
      return reply.send(ok(toCamelCase(mine.rows)));
    }
    requireRole(actor, ["owner", "admin", "teacher"]);
    const sent = await query(
      `SELECT b.id, b.subject, b.body, b.created_at, c.name AS class_name, a.name AS arm_name,
              (SELECT COUNT(*)::int FROM message_broadcast_reads r WHERE r.broadcast_id = b.id) AS recipient_count,
              (SELECT COUNT(*)::int FROM message_broadcast_reads r WHERE r.broadcast_id = b.id AND r.read_at IS NOT NULL) AS read_count
       FROM message_broadcasts b LEFT JOIN classes c ON c.id = b.class_id LEFT JOIN class_arms a ON a.id = b.arm_id
       WHERE b.school_id = $1 AND ($2::boolean OR b.sender_id = $3) ORDER BY b.created_at DESC LIMIT 100`,
      [actor.schoolId, isAdminRole(actor.role), actor.userId]
    );
    return reply.send(ok(toCamelCase(sent.rows)));
  });

  app.patch("/messages/broadcasts/:broadcastId/read", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { broadcastId } = validateParams(request, broadcastParams);
    await query(
      `UPDATE message_broadcast_reads SET read_at = NOW()
       WHERE broadcast_id = $1 AND user_id = $2 AND read_at IS NULL
         AND EXISTS (SELECT 1 FROM message_broadcasts WHERE id = $1 AND school_id = $3)`,
      [broadcastId, actor.userId, actor.schoolId]
    );
    reply.send(ok({ read: true }));
  });
}
