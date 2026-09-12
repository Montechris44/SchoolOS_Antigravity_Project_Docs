import { withTransaction, query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";
import { MarkAttendanceInput } from "./attendance.schemas";

const ATTENDANCE_SELECT =
  "id, school_id, class_id, student_id, date, status, marked_by_user_id, notes, created_at";

export async function listAttendance(schoolId: string, classId: string, date: string) {
  const result = await query(
    `SELECT ${ATTENDANCE_SELECT} FROM attendance_records WHERE school_id = $1 AND class_id = $2 AND date = $3`,
    [schoolId, classId, date]
  );
  return result.rows;
}

export async function markAttendance(schoolId: string, markedByUserId: string, input: MarkAttendanceInput) {
  const classResult = await query<{ id: string }>("SELECT id FROM classes WHERE school_id = $1 AND id = $2", [
    schoolId,
    input.classId,
  ]);

  if (classResult.rowCount === 0) {
    throw new NotFoundError("Class not found.");
  }

  await withTransaction(async (client) => {
    for (const record of input.records) {
      await client.query(
        `INSERT INTO attendance_records (school_id, class_id, student_id, date, status, marked_by_user_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (school_id, class_id, student_id, date)
         DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, marked_by_user_id = EXCLUDED.marked_by_user_id`,
        [schoolId, input.classId, record.studentId, input.date, record.status, markedByUserId, record.notes ?? null]
      );
    }
  });

  return listAttendance(schoolId, input.classId, input.date);
}
