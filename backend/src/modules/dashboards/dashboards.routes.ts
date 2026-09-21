import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { ADMIN_ROLES } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { getCurrentPeriod } from "../../shared/academics/period";
import { toCamelCase } from "../../shared/http/case";
import { NotFoundError } from "../../shared/http/errors";
import { ok } from "../../shared/http/reply";
import { requireRole } from "../../shared/security/tenant-guard";
import { getMyAssignmentSummary } from "../assignments/assignments.service";
import { getMyStatus } from "../staff-attendance/staff-attendance.service";
import { listInvoices } from "../invoices/invoices.service";
import { getStudentNextClass, getStudentToday, getTeacherTimetable } from "../timetable/timetable.service";
import { getStudentHistory } from "../attendance/attendance.service";
import { getMyPublishedResults } from "../results/results.read.service";

const guard = { preHandler: authenticate };

async function upcomingEvents(schoolId: string, isAdmin: boolean) {
  const result = await query(
    `SELECT id, title, event_type, start_date, end_date, location FROM events
     WHERE school_id = $1 AND ($2::boolean OR is_public) AND COALESCE(end_date, start_date) >= NOW()
     ORDER BY start_date ASC LIMIT 5`,
    [schoolId, isAdmin]
  );
  return result.rows;
}

async function unreadCounts(schoolId: string, userId: string) {
  const result = await query<{ notifications: number; messages: number }>(
    `SELECT (SELECT COUNT(*)::int FROM notifications WHERE school_id = $1 AND user_id = $2 AND read_at IS NULL) AS notifications,
            (SELECT COUNT(*)::int FROM messages WHERE school_id = $1 AND recipient_id = $2 AND status = 'SENT') AS messages`,
    [schoolId, userId]
  );
  return result.rows[0];
}

export async function dashboardsRoutes(app: FastifyInstance): Promise<void> {
  // ---- School administrator -------------------------------------------------------
  app.get("/dashboard/admin", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ADMIN_ROLES);
    const period = await getCurrentPeriod(actor.schoolId);

    const [counts, attendance, staffToday, queue, activity, events] = await Promise.all([
      query<Record<string, number>>(
        `SELECT (SELECT COUNT(*)::int FROM students WHERE school_id = $1 AND enrollment_status = 'active') AS students,
                (SELECT COUNT(*)::int FROM staff st JOIN memberships m ON m.school_id = st.school_id AND m.user_id = st.user_id AND m.is_active
                  WHERE st.school_id = $1 AND st.role = 'teacher') AS teachers,
                (SELECT COUNT(*)::int FROM staff st JOIN memberships m ON m.school_id = st.school_id AND m.user_id = st.user_id AND m.is_active
                  WHERE st.school_id = $1) AS staff,
                (SELECT COUNT(*)::int FROM classes WHERE school_id = $1) AS classes`,
        [actor.schoolId]
      ),
      query<{ present: number; marked: number }>(
        `SELECT COUNT(*) FILTER (WHERE status IN ('PRESENT', 'LATE'))::int AS present, COUNT(*)::int AS marked
         FROM attendance_records WHERE school_id = $1 AND date = CURRENT_DATE`,
        [actor.schoolId]
      ),
      query<{ signed_in: number }>(
        "SELECT COUNT(*)::int AS signed_in FROM staff_attendance WHERE school_id = $1 AND attendance_date = CURRENT_DATE AND sign_in_time IS NOT NULL",
        [actor.schoolId]
      ),
      query<{ pending_review: number; returned: number }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_review,
                COUNT(*) FILTER (WHERE status = 'RETURNED_FOR_CORRECTION')::int AS returned
         FROM subject_score_batches WHERE school_id = $1 AND ($2::uuid IS NULL OR term_id = $2)`,
        [actor.schoolId, period.termId]
      ),
      query(
        `SELECT al.id, al.action, al.resource_type, al.created_at, p.full_name AS actor_name
         FROM audit_logs al LEFT JOIN profiles p ON p.id = al.user_id
         WHERE al.school_id = $1 AND al.action NOT IN ('auth.login', 'auth.logout')
         ORDER BY al.created_at DESC LIMIT 8`,
        [actor.schoolId]
      ),
      upcomingEvents(actor.schoolId, true),
    ]);

    reply.send(
      ok(
        toCamelCase({
          period,
          stats: {
            ...counts.rows[0],
            attendanceToday: attendance.rows[0],
            staffSignedInToday: staffToday.rows[0].signed_in,
            results: queue.rows[0],
          },
          recentActivity: activity.rows,
          upcomingEvents: events,
        })
      )
    );
  });

  // ---- Teacher -------------------------------------------------------------------
  app.get("/dashboard/teacher", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["teacher"]);
    const period = await getCurrentPeriod(actor.schoolId);

    const [overview, homeroom, returned, today, unread, events, staffAttendance] = await Promise.all([
      query<{ classes: number; subjects: number; students: number }>(
        `SELECT COUNT(DISTINCT ta.class_id || ':' || COALESCE(ta.arm_id::text, ''))::int AS classes,
                COUNT(DISTINCT ta.subject_id)::int AS subjects,
                (SELECT COUNT(DISTINCT s.id)::int FROM teacher_assignments t2
                 JOIN students s ON s.current_class_id = t2.class_id AND (t2.arm_id IS NULL OR s.arm_id = t2.arm_id) AND s.enrollment_status = 'active'
                 WHERE t2.school_id = $1 AND t2.teacher_id = $2 AND t2.is_active) AS students
         FROM teacher_assignments ta WHERE ta.school_id = $1 AND ta.teacher_id = $2 AND ta.is_active`,
        [actor.schoolId, actor.userId]
      ),
      query(
        `SELECT c.id AS class_id, c.name AS class_name, ca.id AS arm_id, ca.name AS arm_name
         FROM classes c LEFT JOIN class_arms ca ON ca.class_id = c.id AND ca.class_teacher_id = $2
         WHERE c.school_id = $1 AND (c.class_teacher_id = $2 OR ca.class_teacher_id = $2) LIMIT 1`,
        [actor.schoolId, actor.userId]
      ),
      query(
        `SELECT b.id, sub.name AS subject_name, c.name AS class_name, ca.name AS arm_name, b.review_notes, b.status
         FROM subject_score_batches b JOIN subjects sub ON sub.id = b.subject_id JOIN classes c ON c.id = b.class_id
         LEFT JOIN class_arms ca ON ca.id = b.arm_id
         WHERE b.school_id = $1 AND b.teacher_id = $2 AND b.status IN ('RETURNED_FOR_CORRECTION', 'NEEDS_REPUBLISH')`,
        [actor.schoolId, actor.userId]
      ),
      getTeacherTimetable(actor).then((rows) => rows.filter((row) => Number(row.day_of_week) === (new Date().getDay() || 7))),
      unreadCounts(actor.schoolId, actor.userId),
      upcomingEvents(actor.schoolId, false),
      getMyStatus(actor.schoolId, actor.userId),
    ]);

    reply.send(
      ok(
        toCamelCase({
          period,
          stats: overview.rows[0],
          homeroom: homeroom.rows[0] ?? null,
          needsAttention: returned.rows,
          todaySchedule: today,
          unread: unread,
          upcomingEvents: events,
          staffAttendance,
        })
      )
    );
  });

  // ---- Any other staff member: just the attendance widget and messages ---------------
  app.get("/dashboard/staff", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["bursar", "non_academic", "admin", "owner", "teacher"]);
    const [unread, events, staffAttendance] = await Promise.all([
      unreadCounts(actor.schoolId, actor.userId),
      upcomingEvents(actor.schoolId, false),
      getMyStatus(actor.schoolId, actor.userId),
    ]);
    reply.send(ok(toCamelCase({ unread, upcomingEvents: events, staffAttendance })));
  });

  // ---- Student ---------------------------------------------------------------------
  app.get("/dashboard/student", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    const period = await getCurrentPeriod(actor.schoolId);

    const profile = await query<Record<string, any>>(
      `SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo_url, c.name AS class_name, ca.name AS arm_name
       FROM students s JOIN classes c ON c.id = s.current_class_id LEFT JOIN class_arms ca ON ca.id = s.arm_id
       WHERE s.user_id = $1 AND s.school_id = $2`,
      [actor.userId, actor.schoolId]
    );
    if (profile.rowCount === 0) throw new NotFoundError("No student record is linked to this account.");
    const student = profile.rows[0];

    const [today, next, assignments, attendance, results, invoices, unread, events] = await Promise.all([
      getStudentToday(actor),
      getStudentNextClass(actor),
      getMyAssignmentSummary(actor),
      getStudentHistory(actor.schoolId, student.id),
      getMyPublishedResults(actor),
      listInvoices(actor.schoolId, undefined, actor),
      unreadCounts(actor.schoolId, actor.userId),
      upcomingEvents(actor.schoolId, false),
    ]);

    const latest = results[0] ?? null;
    const outstanding = invoices.filter((invoice) => invoice.status !== "CANCELLED").reduce((sum, invoice) => sum + Number(invoice.balance_due), 0);

    reply.send(
      ok(
        toCamelCase({
          student,
          period,
          today,
          nextClass: next,
          assignments,
          attendance: attendance.summary,
          latestResult: latest
            ? {
                termName: latest.term_name,
                sessionName: latest.session_name,
                average: latest.average_score,
                position: latest.position,
                positionSuffix: latest.position_suffix,
                classSize: latest.class_size,
                subjects: latest.subjects.length,
              }
            : null,
          fees: { outstanding, invoices: invoices.length },
          unread,
          upcomingEvents: events,
        })
      )
    );
  });

  app.get("/student/academic-status", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student", "parent"]);
    reply.send(ok(toCamelCase(await getCurrentPeriod(actor.schoolId))));
  });

  app.get("/student/fees", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await listInvoices(actor.schoolId, undefined, actor))));
  });

  app.get("/student/profile", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    const profile = await query(
      `SELECT s.id, s.admission_number, s.first_name, s.last_name, s.middle_name, s.gender, s.date_of_birth, s.photo_url,
              s.address, s.blood_group, s.genotype, c.name AS class_name, ca.name AS arm_name,
              g.first_name AS guardian_first_name, g.last_name AS guardian_last_name, g.phone AS guardian_phone
       FROM students s JOIN classes c ON c.id = s.current_class_id LEFT JOIN class_arms ca ON ca.id = s.arm_id
       LEFT JOIN guardians g ON g.id = s.guardian_id
       WHERE s.user_id = $1 AND s.school_id = $2`,
      [actor.userId, actor.schoolId]
    );
    if (profile.rowCount === 0) throw new NotFoundError("No student record is linked to this account.");
    reply.send(ok(toCamelCase(profile.rows[0])));
  });
}

