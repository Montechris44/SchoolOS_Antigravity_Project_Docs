import { AuthenticatedUser } from "../../middleware/auth";
import { withTransaction, query } from "../../db/pool";
import { assertTeachesClass } from "../../shared/academics/period";
import { NotFoundError } from "../../shared/http/errors";
import { assertClassArm } from "../../shared/security/ownership";
import { MarkAttendanceInput } from "./attendance.schemas";

const ATTENDANCE_SELECT =
  "id, school_id, class_id, arm_id, student_id, date, status, marked_by_user_id, notes, created_at";

export const assertCanTakeAttendance = assertTeachesClass;

export async function listAttendance(schoolId: string, classId: string, date: string, armId?: string) {
  const result = await query(
    `SELECT ${ATTENDANCE_SELECT} FROM attendance_records
     WHERE school_id = $1 AND class_id = $2 AND date = $3 AND ($4::uuid IS NULL OR arm_id = $4)`,
    [schoolId, classId, date, armId ?? null]
  );
  return result.rows;
}

/** Class roster with whatever has already been recorded for the day — the register the teacher fills in. */
export async function getRoster(actor: AuthenticatedUser, classId: string, date: string, armId?: string) {
  await assertClassArm(actor.schoolId, classId, armId);
  await assertCanTakeAttendance(actor, classId, armId);

  const result = await query(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name, s.photo_url, s.arm_id,
            ar.status, ar.notes,
            (SELECT COUNT(*)::int FROM leave_passes lp
             WHERE lp.student_id = s.id AND lp.school_id = s.school_id AND lp.status = 'APPROVED'
               AND $3::date BETWEEN lp.start_date AND lp.end_date) > 0 AS on_leave
     FROM students s
     LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.class_id = s.current_class_id AND ar.date = $3
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active'
       AND ($4::uuid IS NULL OR s.arm_id = $4)
     ORDER BY s.last_name, s.first_name`,
    [actor.schoolId, classId, date, armId ?? null]
  );
  return result.rows;
}

export async function markAttendance(actor: AuthenticatedUser, input: MarkAttendanceInput) {
  await assertClassArm(actor.schoolId, input.classId, input.armId);
  await assertCanTakeAttendance(actor, input.classId, input.armId);

  const roster = await query<{ id: string; arm_id: string | null }>(
    `SELECT id, arm_id FROM students
     WHERE school_id = $1 AND current_class_id = $2 AND enrollment_status = 'active' AND id = ANY($3::uuid[])`,
    [actor.schoolId, input.classId, input.records.map((record) => record.studentId)]
  );
  const armOf = new Map(roster.rows.map((row) => [row.id, row.arm_id]));
  if (input.records.some((record) => !armOf.has(record.studentId))) {
    throw new NotFoundError("One or more students are not in this class.");
  }

  await withTransaction(async (client) => {
    for (const record of input.records) {
      await client.query(
        `INSERT INTO attendance_records (school_id, class_id, arm_id, student_id, date, status, marked_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (school_id, class_id, student_id, date)
         DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, marked_by_user_id = EXCLUDED.marked_by_user_id,
                       arm_id = EXCLUDED.arm_id`,
        [
          actor.schoolId,
          input.classId,
          armOf.get(record.studentId) ?? null,
          record.studentId,
          input.date,
          record.status,
          actor.userId,
          record.notes ?? null,
        ]
      );
    }
  });

  return listAttendance(actor.schoolId, input.classId, input.date, input.armId ?? undefined);
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Whole-school attendance picture for administrators: headline rates, the day's registers and a per-class summary. */
export async function getOverview(
  schoolId: string,
  filters: { date?: string; from?: string; to?: string; classId?: string }
) {
  const date = filters.date ?? today();
  const from = filters.from ?? daysAgo(29);
  const to = filters.to ?? date;

  const metrics = await query<{ total_sessions: number; classes_tracked: number; presentish: number; absent_count: number; total_marked: number }>(
    `SELECT COUNT(DISTINCT (class_id, date))::int AS total_sessions, COUNT(DISTINCT class_id)::int AS classes_tracked,
            COUNT(*) FILTER (WHERE status IN ('PRESENT', 'LATE'))::int AS presentish,
            COUNT(*) FILTER (WHERE status = 'ABSENT')::int AS absent_count, COUNT(*)::int AS total_marked
     FROM attendance_records
     WHERE school_id = $1 AND date BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR class_id = $4)`,
    [schoolId, from, to, filters.classId ?? null]
  );
  const m = metrics.rows[0];

  const registers = await query<Record<string, any>>(
    `SELECT ar.class_id, ar.arm_id, c.name AS class_name, a.name AS arm_name, ar.date, p.full_name AS recorded_by,
            COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
            COUNT(*) FILTER (WHERE ar.status = 'LATE')::int AS late,
            COUNT(*) FILTER (WHERE ar.status = 'EXCUSED')::int AS excused,
            COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent,
            COUNT(*)::int AS total,
            COALESCE(json_agg(json_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name,
              'admission_number', s.admission_number, 'status', ar.status, 'notes', ar.notes)
              ORDER BY s.last_name, s.first_name), '[]') AS students
     FROM attendance_records ar
     JOIN classes c ON c.id = ar.class_id
     LEFT JOIN class_arms a ON a.id = ar.arm_id
     JOIN students s ON s.id = ar.student_id
     LEFT JOIN profiles p ON p.id = ar.marked_by_user_id
     WHERE ar.school_id = $1 AND ar.date = $2::date AND ($3::uuid IS NULL OR ar.class_id = $3)
     GROUP BY ar.class_id, ar.arm_id, c.name, a.name, ar.date, p.full_name
     ORDER BY c.name, a.name NULLS FIRST`,
    [schoolId, date, filters.classId ?? null]
  );

  const classSummary = await query(
    `SELECT ar.class_id, c.name AS class_name, COUNT(DISTINCT ar.date)::int AS sessions,
            COUNT(*) FILTER (WHERE ar.status IN ('PRESENT', 'LATE'))::int AS present,
            COUNT(*) FILTER (WHERE ar.status = 'LATE')::int AS late,
            COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent, COUNT(*)::int AS total,
            ROUND((COUNT(*) FILTER (WHERE ar.status IN ('PRESENT', 'LATE'))::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS attendance_pct
     FROM attendance_records ar JOIN classes c ON c.id = ar.class_id
     WHERE ar.school_id = $1 AND ar.date BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR ar.class_id = $4)
     GROUP BY ar.class_id, c.name ORDER BY c.name`,
    [schoolId, from, to, filters.classId ?? null]
  );

  const marked = m.total_marked;
  return {
    date,
    range: { from, to },
    metrics: {
      overallAttendancePct: marked > 0 ? Number(((m.presentish / marked) * 100).toFixed(1)) : 0,
      totalSessions: m.total_sessions,
      classesTracked: m.classes_tracked,
      avgAbsentRate: marked > 0 ? Number(((m.absent_count / marked) * 100).toFixed(1)) : 0,
    },
    dailyRecords: registers.rows,
    classSummary: classSummary.rows,
  };
}

/** Per-student rates across a date range, optionally narrowed to a class, arm or one student. */
export async function getStudentRates(
  schoolId: string,
  filters: { from?: string; to?: string; classId?: string; armId?: string; studentId?: string }
) {
  const from = filters.from ?? daysAgo(29);
  const to = filters.to ?? today();

  const rows = await query(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name, c.name AS class_name, a.name AS arm_name,
            COUNT(*) FILTER (WHERE ar.status = 'PRESENT')::int AS present,
            COUNT(*) FILTER (WHERE ar.status = 'LATE')::int AS late,
            COUNT(*) FILTER (WHERE ar.status = 'EXCUSED')::int AS excused,
            COUNT(*) FILTER (WHERE ar.status = 'ABSENT')::int AS absent, COUNT(*)::int AS total,
            ROUND((COUNT(*) FILTER (WHERE ar.status IN ('PRESENT', 'LATE'))::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS attendance_rate
     FROM attendance_records ar
     JOIN students s ON s.id = ar.student_id
     JOIN classes c ON c.id = ar.class_id
     LEFT JOIN class_arms a ON a.id = ar.arm_id
     WHERE ar.school_id = $1 AND ar.date BETWEEN $2::date AND $3::date
       AND ($4::uuid IS NULL OR ar.class_id = $4) AND ($5::uuid IS NULL OR ar.arm_id = $5) AND ($6::uuid IS NULL OR ar.student_id = $6)
     GROUP BY s.id, c.name, a.name
     ORDER BY s.last_name, s.first_name`,
    [schoolId, from, to, filters.classId ?? null, filters.armId ?? null, filters.studentId ?? null]
  );
  return { range: { from, to }, byStudent: rows.rows };
}

/** A student's own attendance (also used for a parent viewing a child, after visibility is checked). */
export async function getStudentHistory(schoolId: string, studentId: string, range: { from?: string; to?: string } = {}) {
  const from = range.from ?? daysAgo(89);
  const to = range.to ?? today();

  const records = await query(
    `SELECT date, status, notes FROM attendance_records
     WHERE school_id = $1 AND student_id = $2 AND date BETWEEN $3::date AND $4::date ORDER BY date DESC`,
    [schoolId, studentId, from, to]
  );
  const counts = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const row of records.rows) {
    const key = String(row.status).toLowerCase() as keyof typeof counts;
    counts[key] += 1;
  }
  const total = records.rows.length;
  return {
    range: { from, to },
    summary: { ...counts, total, attendancePct: total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0 },
    records: records.rows,
  };
}

