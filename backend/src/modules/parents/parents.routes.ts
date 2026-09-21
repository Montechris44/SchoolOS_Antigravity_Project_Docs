import bcrypt from "bcryptjs";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { query, withTransaction } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { generateTemporaryPassword } from "../../shared/security/credentials";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateParams } from "../../shared/validation/validate";
import { getStudentAcademicSummary } from "../students/students.service";
import { listInvoices } from "../invoices/invoices.service";

const guardianParams = z.object({ guardianId: z.string().uuid() });
const studentParams = z.object({ studentId: z.string().uuid() });
const guard = { preHandler: authenticate };

export async function parentsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * The administrator gives a guardian a sign-in account. Parents cannot register themselves: a self-service
   * link between an account and a child is exactly what an attacker would abuse to read someone's results.
   */
  app.post("/guardians/:guardianId/portal-account", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "students:manage");
    const { guardianId } = validateParams(request, guardianParams);

    const guardian = await query<{ id: string; first_name: string; last_name: string; email: string; user_id: string | null }>(
      "SELECT id, first_name, last_name, email, user_id FROM guardians WHERE id = $1 AND school_id = $2",
      [guardianId, actor.schoolId]
    );
    const row = guardian.rows[0];
    if (!row) throw new NotFoundError("Guardian not found.");
    if (row.user_id) throw new ConflictError("This guardian already has a sign-in account.");

    const email = row.email.toLowerCase();
    if ((await query("SELECT 1 FROM profiles WHERE email = $1", [email])).rowCount) {
      throw new ConflictError("An account with this e-mail already exists. Use a different guardian e-mail address.");
    }

    const temporaryPassword = generateTemporaryPassword();
    await withTransaction(async (client) => {
      const profile = await client.query<{ id: string }>(
        `INSERT INTO profiles (email, full_name, password_hash, force_password_change) VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [email, `${row.first_name} ${row.last_name}`, await bcrypt.hash(temporaryPassword, 12)]
      );
      await client.query("INSERT INTO memberships (school_id, user_id, role, is_active) VALUES ($1, $2, 'parent', TRUE)", [
        actor.schoolId,
        profile.rows[0].id,
      ]);
      await client.query("UPDATE guardians SET user_id = $1 WHERE id = $2 AND school_id = $3", [profile.rows[0].id, guardianId, actor.schoolId]);
    });

    await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: "guardian.portal_account_created", resourceType: "guardian", resourceId: guardianId });
    reply.status(201).send(created({ email, temporaryPassword }));
  });

  // ---- What a signed-in parent sees ----------------------------------------------
  app.get("/parent/children", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["parent"]);
    reply.send(ok(toCamelCase(await loadChildren(actor.schoolId, actor.userId))));
  });

  app.get("/parent/children/:studentId/summary", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["parent"]);
    const { studentId } = validateParams(request, studentParams);
    reply.send(ok(toCamelCase(await getStudentAcademicSummary(actor, studentId))));
  });

  app.get("/parent/children/:studentId/fees", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["parent"]);
    const { studentId } = validateParams(request, studentParams);
    // The finance scope only ever returns invoices of this parent's own children.
    reply.send(ok(toCamelCase(await listInvoices(actor.schoolId, studentId, actor))));
  });
}

async function loadChildren(schoolId: string, parentUserId: string) {
  const result = await query(
    `SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo_url, s.gender,
            c.name AS class_name, ca.name AS arm_name,
            (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status IN ('PRESENT', 'LATE')) / NULLIF(COUNT(*), 0))::int
             FROM attendance_records ar WHERE ar.student_id = s.id) AS attendance_pct,
            (SELECT COALESCE(SUM(i.balance_due), 0) FROM invoices i WHERE i.student_id = s.id AND i.status <> 'CANCELLED') AS outstanding_balance,
            (SELECT json_build_object('term_id', r.term_id, 'term_name', t.name, 'average', r.average_score,
                                      'position', r.position, 'position_suffix', r.position_suffix)
             FROM results r JOIN terms t ON t.id = r.term_id
             WHERE r.student_id = s.id AND r.approval_status = 'PUBLISHED' ORDER BY t.start_date DESC LIMIT 1) AS latest_result
     FROM students s
     JOIN guardians g ON g.id = s.guardian_id
     JOIN classes c ON c.id = s.current_class_id
     LEFT JOIN class_arms ca ON ca.id = s.arm_id
     WHERE s.school_id = $1 AND g.user_id = $2 AND s.enrollment_status = 'active'
     ORDER BY s.first_name`,
    [schoolId, parentUserId]
  );
  return result.rows;
}
