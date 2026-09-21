import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { isAdminRole } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { notifyRoles, notifyUser } from "../../shared/academics/notifications";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { getStudentById, listStudents } from "../students/students.service";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const guard = { preHandler: authenticate };
const STAFF_ROLES = ["admin", "teacher", "bursar", "non_academic"] as const;

const passCreate = z
  .object({ studentId: uuid, leaveType: z.string().min(2).max(50).default("GENERAL"), reason: z.string().min(3).max(1000), startDate: date, endDate: date })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date must not be before the start date.", path: ["endDate"] });
const passReview = z.object({ status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]), rejectionReason: z.string().max(500).nullish() });
const passList = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(), studentId: uuid.optional() });
const idSchema = z.object({ id: uuid });

const staffCreate = z
  .object({ leaveType: z.string().min(2).max(50).default("OTHER"), reason: z.string().min(3).max(1000), startDate: date, endDate: date })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date must not be before the start date.", path: ["endDate"] });
const staffReview = z.object({ status: z.enum(["APPROVED", "REJECTED"]), reviewNotes: z.string().max(500).nullish() });
const staffList = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional() });

const PASS_COLUMNS = `lp.id, lp.student_id, lp.leave_type, lp.reason, lp.start_date, lp.end_date, lp.status, lp.rejection_reason, lp.approved_at, lp.created_at,
  s.admission_number, s.first_name, s.last_name, s.photo_url, c.name AS class_name, req.full_name AS requested_by_name, apr.full_name AS approved_by_name`;
const PASS_FROM = `FROM leave_passes lp JOIN students s ON s.id = lp.student_id JOIN classes c ON c.id = s.current_class_id
  LEFT JOIN profiles req ON req.id = lp.requested_by LEFT JOIN profiles apr ON apr.id = lp.approved_by`;

export async function leaveRoutes(app: FastifyInstance): Promise<void> {
  // ---- Student leave passes ------------------------------------------------------
  app.get("/leave-passes", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { status, studentId } = validateQuery(request, passList);

    // Administrators see everything; teachers, parents and students see the passes of students they may see.
    let visibleIds: string[] | null = null;
    if (!isAdminRole(actor.role)) {
      visibleIds = (await listStudents(actor)).map((student) => student.id);
      if (visibleIds.length === 0) return reply.send(ok([]));
    }

    const rows = await query(
      `SELECT ${PASS_COLUMNS} ${PASS_FROM}
       WHERE lp.school_id = $1 AND ($2::text IS NULL OR lp.status = $2) AND ($3::uuid IS NULL OR lp.student_id = $3)
         AND ($4::uuid[] IS NULL OR lp.student_id = ANY($4::uuid[]))
       ORDER BY lp.created_at DESC LIMIT 300`,
      [actor.schoolId, status ?? null, studentId ?? null, visibleIds]
    );
    return reply.send(ok(toCamelCase(rows.rows)));
  });

  app.post("/leave-passes", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["owner", "admin", "teacher", "parent"]);
    const input = validateBody(request, passCreate);
    await getStudentById(actor, input.studentId); // visibility: a parent can only request for their own child

    const result = await query<{ id: string }>(
      `INSERT INTO leave_passes (school_id, student_id, requested_by, leave_type, reason, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [actor.schoolId, input.studentId, actor.userId, input.leaveType, input.reason, input.startDate, input.endDate, isAdminRole(actor.role) ? "APPROVED" : "PENDING"]
    );
    if (!isAdminRole(actor.role)) {
      await notifyRoles(actor.schoolId, ["owner", "admin"], {
        type: "LEAVE_PASS_REQUESTED",
        title: "Leave pass awaiting approval",
        message: input.reason.slice(0, 200),
        entityType: "leave_pass",
        entityId: result.rows[0].id,
      });
    }
    const created_ = await query(`SELECT ${PASS_COLUMNS} ${PASS_FROM} WHERE lp.id = $1`, [result.rows[0].id]);
    reply.status(201).send(created(toCamelCase(created_.rows[0])));
  });

  app.patch("/leave-passes/:id", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "leave:manage");
    const { id } = validateParams(request, idSchema);
    const { status, rejectionReason } = validateBody(request, passReview);

    const result = await query<{ student_id: string; start_date: string; end_date: string }>(
      `UPDATE leave_passes SET status = $3, approved_by = $4, approved_at = NOW(), rejection_reason = $5
       WHERE id = $1 AND school_id = $2 RETURNING student_id, start_date, end_date`,
      [id, actor.schoolId, status, actor.userId, status === "REJECTED" ? rejectionReason ?? null : null]
    );
    if (result.rowCount === 0) throw new NotFoundError("Leave pass not found.");

    const pass = result.rows[0];
    const owners = await query<{ user_id: string }>(
      `SELECT s.user_id FROM students s WHERE s.id = $1 AND s.user_id IS NOT NULL
       UNION SELECT g.user_id FROM students s JOIN guardians g ON g.id = s.guardian_id WHERE s.id = $1 AND g.user_id IS NOT NULL`,
      [pass.student_id]
    );
    for (const owner of owners.rows) {
      await notifyUser(actor.schoolId, owner.user_id, {
        type: `LEAVE_PASS_${status}`,
        title: `Leave pass ${status.toLowerCase()}`,
        message: `${pass.start_date} – ${pass.end_date}`,
        entityType: "leave_pass",
        entityId: id,
      });
    }
    await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: `leave_pass.${status.toLowerCase()}`, resourceType: "leave_pass", resourceId: id });
    reply.send(ok({ id, status }));
  });

  // ---- Staff leave requests ------------------------------------------------------
  const STAFF_COLUMNS = `l.id, l.staff_user_id, l.leave_type, l.reason, l.start_date, l.end_date, l.status, l.review_notes, l.reviewed_at, l.created_at, p.full_name AS staff_name`;

  app.get("/staff-leave", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "leave:manage");
    const { status } = validateQuery(request, staffList);
    const rows = await query(
      `SELECT ${STAFF_COLUMNS} FROM staff_leave_requests l JOIN profiles p ON p.id = l.staff_user_id
       WHERE l.school_id = $1 AND ($2::text IS NULL OR l.status = $2) ORDER BY l.created_at DESC LIMIT 300`,
      [actor.schoolId, status ?? null]
    );
    reply.send(ok(toCamelCase(rows.rows)));
  });

  app.get("/staff-leave/mine", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, [...STAFF_ROLES]);
    const rows = await query(
      `SELECT ${STAFF_COLUMNS} FROM staff_leave_requests l JOIN profiles p ON p.id = l.staff_user_id
       WHERE l.school_id = $1 AND l.staff_user_id = $2 ORDER BY l.created_at DESC LIMIT 100`,
      [actor.schoolId, actor.userId]
    );
    reply.send(ok(toCamelCase(rows.rows)));
  });

  app.post("/staff-leave", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, [...STAFF_ROLES]);
    const input = validateBody(request, staffCreate);

    const result = await query<{ id: string }>(
      `INSERT INTO staff_leave_requests (school_id, staff_user_id, leave_type, reason, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [actor.schoolId, actor.userId, input.leaveType, input.reason, input.startDate, input.endDate]
    );
    await notifyRoles(actor.schoolId, ["owner", "admin"], {
      type: "STAFF_LEAVE_REQUESTED",
      title: "Staff leave request",
      message: input.reason.slice(0, 200),
      entityType: "staff_leave_request",
      entityId: result.rows[0].id,
    });
    reply.status(201).send(created({ id: result.rows[0].id, status: "PENDING" }));
  });

  app.patch("/staff-leave/:id/review", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "leave:manage");
    const { id } = validateParams(request, idSchema);
    const { status, reviewNotes } = validateBody(request, staffReview);

    const result = await query<{ staff_user_id: string }>(
      `UPDATE staff_leave_requests SET status = $3, review_notes = $4, reviewed_by = $5, reviewed_at = NOW()
       WHERE id = $1 AND school_id = $2 AND status = 'PENDING' RETURNING staff_user_id`,
      [id, actor.schoolId, status, reviewNotes ?? null, actor.userId]
    );
    if (result.rowCount === 0) throw new ConflictError("This request was not found or has already been reviewed.");

    await notifyUser(actor.schoolId, result.rows[0].staff_user_id, {
      type: `STAFF_LEAVE_${status}`,
      title: `Leave request ${status.toLowerCase()}`,
      message: reviewNotes ?? "",
      entityType: "staff_leave_request",
      entityId: id,
    });
    await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: `staff_leave.${status.toLowerCase()}`, resourceType: "staff_leave_request", resourceId: id });
    reply.send(ok({ id, status }));
  });

  app.patch("/staff-leave/:id/cancel", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, [...STAFF_ROLES]);
    const { id } = validateParams(request, idSchema);
    const result = await query(
      "UPDATE staff_leave_requests SET status = 'CANCELLED' WHERE id = $1 AND school_id = $2 AND staff_user_id = $3 AND status = 'PENDING'",
      [id, actor.schoolId, actor.userId]
    );
    if (result.rowCount === 0) throw new NotFoundError("Only your own pending requests can be cancelled.");
    reply.send(ok({ id, status: "CANCELLED" }));
  });
}
