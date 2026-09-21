import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { isAdminRole } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { BadRequestError, NotFoundError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";

const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

const eventFields = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullish(),
  eventType: z.enum(["ACADEMIC", "SOCIAL", "SPORTS", "EXAMINATION", "HOLIDAY", "OTHER"]).default("ACADEMIC"),
  startDate: date,
  endDate: date.nullish(),
  location: z.string().max(200).nullish(),
  isPublic: z.boolean().default(true),
});
const createSchema = eventFields.refine((e) => !e.endDate || Date.parse(e.endDate) >= Date.parse(e.startDate), {
  message: "The end must not be before the start.",
  path: ["endDate"],
});
const updateSchema = eventFields.partial();
const listSchema = z.object({ from: date.optional(), to: date.optional(), upcoming: z.enum(["true", "false"]).optional() });
const idSchema = z.object({ eventId: z.string().uuid() });

const guard = { preHandler: authenticate };
const COLUMNS = "id, title, description, event_type, start_date, end_date, location, is_public, created_at";

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  // Everyone in the school sees public events; administrators also see private ones.
  app.get("/events", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { from, to, upcoming } = validateQuery(request, listSchema);
    const result = await query(
      `SELECT ${COLUMNS} FROM events
       WHERE school_id = $1 AND ($2::boolean OR is_public)
         AND ($3::timestamptz IS NULL OR COALESCE(end_date, start_date) >= $3)
         AND ($4::timestamptz IS NULL OR start_date <= $4)
         AND ($5::boolean IS NOT TRUE OR COALESCE(end_date, start_date) >= NOW())
       ORDER BY start_date ${upcoming === "true" ? "ASC" : "DESC"} LIMIT 300`,
      [actor.schoolId, isAdminRole(actor.role), from ?? null, to ?? null, upcoming === "true"]
    );
    reply.send(ok(toCamelCase(result.rows)));
  });

  app.post("/events", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "events:manage");
    const input = validateBody(request, createSchema);

    const result = await query<{ id: string }>(
      `INSERT INTO events (school_id, created_by, title, description, event_type, start_date, end_date, location, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${COLUMNS}`,
      [actor.schoolId, actor.userId, input.title, input.description ?? null, input.eventType, input.startDate, input.endDate ?? null, input.location ?? null, input.isPublic]
    );
    await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: "event.created", resourceType: "event", resourceId: result.rows[0].id });
    reply.status(201).send(created(toCamelCase(result.rows[0])));
  });

  app.put("/events/:eventId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "events:manage");
    const { eventId } = validateParams(request, idSchema);
    const input = validateBody(request, updateSchema);
    if (Object.keys(input).length === 0) throw new BadRequestError("Nothing to update.");

    const result = await query(
      `UPDATE events SET
         title = COALESCE($3, title), description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         event_type = COALESCE($6, event_type), start_date = COALESCE($7, start_date),
         end_date = CASE WHEN $8::boolean THEN $9::timestamptz ELSE end_date END,
         location = CASE WHEN $10::boolean THEN $11 ELSE location END, is_public = COALESCE($12, is_public)
       WHERE id = $1 AND school_id = $2 RETURNING ${COLUMNS}`,
      [
        eventId,
        actor.schoolId,
        input.title ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.eventType ?? null,
        input.startDate ?? null,
        input.endDate !== undefined,
        input.endDate ?? null,
        input.location !== undefined,
        input.location ?? null,
        input.isPublic ?? null,
      ]
    );
    if (result.rowCount === 0) throw new NotFoundError("Event not found.");
    reply.send(ok(toCamelCase(result.rows[0])));
  });

  app.delete("/events/:eventId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "events:manage");
    const { eventId } = validateParams(request, idSchema);
    const result = await query("DELETE FROM events WHERE id = $1 AND school_id = $2", [eventId, actor.schoolId]);
    if (result.rowCount === 0) throw new NotFoundError("Event not found.");
    await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: "event.deleted", resourceType: "event", resourceId: eventId });
    reply.send(ok({ deleted: true }));
  });
}
