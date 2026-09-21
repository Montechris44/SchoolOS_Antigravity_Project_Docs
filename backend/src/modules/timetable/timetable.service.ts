import { query } from "../../db/pool";
import { AuthenticatedUser } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { assertClassArm, assertOwned, assertSchoolMember } from "../../shared/security/ownership";
import { getCurrentPeriod } from "../../shared/academics/period";

export interface TimetableInput {
  classId: string;
  armId?: string | null;
  termId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

export const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const ENTRY_SELECT = `
  SELECT t.id, t.class_id, t.arm_id, t.term_id, t.subject_id, t.teacher_id, t.day_of_week,
         to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time, t.room,
         sub.name AS subject_name, sub.code AS subject_code, p.full_name AS teacher_name,
         c.name AS class_name, ca.name AS arm_name, term.name AS term_name
  FROM timetable t
  LEFT JOIN subjects sub ON sub.id = t.subject_id
  LEFT JOIN profiles p ON p.id = t.teacher_id
  JOIN classes c ON c.id = t.class_id
  LEFT JOIN class_arms ca ON ca.id = t.arm_id
  LEFT JOIN terms term ON term.id = t.term_id
`;

function decorate(entry: Record<string, any>): Record<string, any> {
  const title = entry.subject_name || entry.room || "Break";
  const lower = String(title).toLowerCase();
  return {
    ...entry,
    day_name: DAY_NAMES[Number(entry.day_of_week)] ?? String(entry.day_of_week),
    display_title: title,
    is_break: !entry.subject_id && lower.includes("break"),
    is_lunch: !entry.subject_id && lower.includes("lunch"),
  };
}

export async function listEntries(
  schoolId: string,
  filters: { classId?: string; armId?: string; teacherId?: string; termId?: string; dayOfWeek?: number; id?: string } = {}
) {
  const result = await query<Record<string, any>>(
    `${ENTRY_SELECT}
     WHERE t.school_id = $1
       AND ($2::uuid IS NULL OR t.class_id = $2)
       AND ($3::uuid IS NULL OR t.arm_id = $3 OR t.arm_id IS NULL)
       AND ($4::uuid IS NULL OR t.teacher_id = $4)
       AND ($5::uuid IS NULL OR t.term_id = $5 OR t.term_id IS NULL)
       AND ($6::int IS NULL OR t.day_of_week = $6)
       AND ($7::uuid IS NULL OR t.id = $7)
     ORDER BY t.day_of_week, t.start_time`,
    [
      schoolId,
      filters.classId ?? null,
      filters.armId ?? null,
      filters.teacherId ?? null,
      filters.termId ?? null,
      filters.dayOfWeek ?? null,
      filters.id ?? null,
    ]
  );
  return result.rows.map(decorate);
}

// ---- Conflicts ------------------------------------------------------------------

interface Conflict {
  type: "CLASS" | "TEACHER" | "ROOM" | "DUPLICATE_SUBJECT";
  message: string;
  existingId: string;
}

async function findConflicts(schoolId: string, data: TimetableInput, excludeId?: string): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const overlap = "(($5::time, $6::time) OVERLAPS (start_time, end_time))";
  const period = "($4::uuid IS NULL OR term_id = $4 OR term_id IS NULL)";
  const notSelf = "($7::uuid IS NULL OR id <> $7)";

  const classClash = await query<{ id: string }>(
    `SELECT id FROM timetable
     WHERE school_id = $1 AND class_id = $2 AND day_of_week = $3 AND ${period} AND ${overlap} AND ${notSelf}
       AND ($8::uuid IS NULL OR arm_id = $8 OR arm_id IS NULL)
     LIMIT 1`,
    [schoolId, data.classId, data.dayOfWeek, data.termId ?? null, data.startTime, data.endTime, excludeId ?? null, data.armId ?? null]
  );
  if (classClash.rows[0]) {
    conflicts.push({ type: "CLASS", message: "This class already has a lesson at that time.", existingId: classClash.rows[0].id });
  }

  if (data.teacherId) {
    const teacherClash = await query<{ id: string }>(
      `SELECT id FROM timetable
       WHERE school_id = $1 AND teacher_id = $2 AND day_of_week = $3 AND ${period} AND ${overlap} AND ${notSelf}
       LIMIT 1`,
      [schoolId, data.teacherId, data.dayOfWeek, data.termId ?? null, data.startTime, data.endTime, excludeId ?? null]
    );
    if (teacherClash.rows[0]) {
      conflicts.push({ type: "TEACHER", message: "This teacher is already teaching another class at that time.", existingId: teacherClash.rows[0].id });
    }
  }

  if (data.room) {
    const roomClash = await query<{ id: string }>(
      `SELECT id FROM timetable
       WHERE school_id = $1 AND LOWER(room) = LOWER($2) AND day_of_week = $3 AND ${period} AND ${overlap} AND ${notSelf}
       LIMIT 1`,
      [schoolId, data.room, data.dayOfWeek, data.termId ?? null, data.startTime, data.endTime, excludeId ?? null]
    );
    if (roomClash.rows[0]) {
      conflicts.push({ type: "ROOM", message: "That room is already in use at that time.", existingId: roomClash.rows[0].id });
    }
  }
  return conflicts;
}

async function validateReferences(schoolId: string, data: TimetableInput): Promise<void> {
  await assertClassArm(schoolId, data.classId, data.armId);
  if (data.subjectId) await assertOwned(schoolId, "subjects", data.subjectId, "Subject");
  if (data.termId) await assertOwned(schoolId, "terms", data.termId, "Term");
  if (data.teacherId) await assertSchoolMember(schoolId, data.teacherId, "Teacher", ["teacher"]);
}

export async function createEntry(schoolId: string, actorId: string, data: TimetableInput) {
  await validateReferences(schoolId, data);
  const conflicts = await findConflicts(schoolId, data);
  if (conflicts.length > 0) throw new ConflictError(conflicts[0].message);

  const created = await query<{ id: string }>(
    `INSERT INTO timetable (school_id, class_id, arm_id, term_id, subject_id, teacher_id, day_of_week, start_time, end_time, room)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      schoolId,
      data.classId,
      data.armId ?? null,
      data.termId ?? null,
      data.subjectId ?? null,
      data.teacherId ?? null,
      data.dayOfWeek,
      data.startTime,
      data.endTime,
      data.room?.trim() || null,
    ]
  );

  // A teacher who is timetabled for a subject in a class can also enter results for it.
  if (data.teacherId && data.subjectId) {
    const staff = await query<{ id: string }>("SELECT id FROM staff WHERE school_id = $1 AND user_id = $2", [schoolId, data.teacherId]);
    if (staff.rows[0]) {
      await query(
        `INSERT INTO teacher_assignments (school_id, staff_id, teacher_id, class_id, arm_id, subject_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (school_id, teacher_id, class_id, subject_id, COALESCE(arm_id, '00000000-0000-0000-0000-000000000000'::uuid))
           WHERE teacher_id IS NOT NULL AND subject_id IS NOT NULL
         DO UPDATE SET is_active = TRUE`,
        [schoolId, staff.rows[0].id, data.teacherId, data.classId, data.armId ?? null, data.subjectId]
      );
    }
  }

  await recordAuditLog({ schoolId, userId: actorId, action: "timetable.created", resourceType: "timetable", resourceId: created.rows[0].id });
  return (await listEntries(schoolId, { id: created.rows[0].id }))[0];
}

export async function updateEntry(schoolId: string, actorId: string, id: string, patch: Partial<TimetableInput>) {
  const existing = (await listEntries(schoolId, { id }))[0];
  if (!existing) throw new NotFoundError("Timetable entry not found.");

  const merged: TimetableInput = {
    classId: patch.classId ?? existing.class_id,
    armId: patch.armId === undefined ? existing.arm_id : patch.armId,
    termId: patch.termId === undefined ? existing.term_id : patch.termId,
    subjectId: patch.subjectId === undefined ? existing.subject_id : patch.subjectId,
    teacherId: patch.teacherId === undefined ? existing.teacher_id : patch.teacherId,
    dayOfWeek: patch.dayOfWeek ?? existing.day_of_week,
    startTime: patch.startTime ?? existing.start_time,
    endTime: patch.endTime ?? existing.end_time,
    room: patch.room === undefined ? existing.room : patch.room,
  };
  await validateReferences(schoolId, merged);
  const conflicts = await findConflicts(schoolId, merged, id);
  if (conflicts.length > 0) throw new ConflictError(conflicts[0].message);

  await query(
    `UPDATE timetable SET class_id = $3, arm_id = $4, term_id = $5, subject_id = $6, teacher_id = $7,
       day_of_week = $8, start_time = $9, end_time = $10, room = $11
     WHERE id = $1 AND school_id = $2`,
    [id, schoolId, merged.classId, merged.armId ?? null, merged.termId ?? null, merged.subjectId ?? null, merged.teacherId ?? null, merged.dayOfWeek, merged.startTime, merged.endTime, merged.room?.trim() || null]
  );
  await recordAuditLog({ schoolId, userId: actorId, action: "timetable.updated", resourceType: "timetable", resourceId: id });
  return (await listEntries(schoolId, { id }))[0];
}

export async function deleteEntry(schoolId: string, actorId: string, id: string): Promise<void> {
  const result = await query("DELETE FROM timetable WHERE id = $1 AND school_id = $2", [id, schoolId]);
  if (result.rowCount === 0) throw new NotFoundError("Timetable entry not found.");
  await recordAuditLog({ schoolId, userId: actorId, action: "timetable.deleted", resourceType: "timetable", resourceId: id });
}

/** Bulk paths report which rows made it and why the others did not, instead of failing the whole batch. */
export async function importEntries(schoolId: string, actorId: string, entries: TimetableInput[]) {
  const imported: unknown[] = [];
  const failed: Array<{ index: number; reason: string }> = [];
  for (const [index, entry] of entries.entries()) {
    try {
      imported.push(await createEntry(schoolId, actorId, entry));
    } catch (error) {
      failed.push({ index, reason: (error as Error).message });
    }
  }
  return { importedCount: imported.length, failedCount: failed.length, imported, failed };
}

export async function copyEntries(
  schoolId: string,
  actorId: string,
  input: { fromClassId: string; toClassId: string; fromArmId?: string | null; toArmId?: string | null; fromTermId?: string; toTermId?: string }
) {
  await assertClassArm(schoolId, input.fromClassId, input.fromArmId);
  await assertClassArm(schoolId, input.toClassId, input.toArmId);

  const source = await listEntries(schoolId, {
    classId: input.fromClassId,
    armId: input.fromArmId ?? undefined,
    termId: input.fromTermId,
  });
  const copied: unknown[] = [];
  const skipped: Array<{ sourceId: string; reason: string }> = [];
  for (const row of source) {
    try {
      copied.push(
        await createEntry(schoolId, actorId, {
          classId: input.toClassId,
          armId: input.toArmId ?? null,
          termId: input.toTermId ?? row.term_id ?? null,
          subjectId: row.subject_id,
          teacherId: row.teacher_id,
          dayOfWeek: Number(row.day_of_week),
          startTime: row.start_time,
          endTime: row.end_time,
          room: row.room,
        })
      );
    } catch (error) {
      skipped.push({ sourceId: row.id, reason: (error as Error).message });
    }
  }
  return { copiedCount: copied.length, skippedCount: skipped.length, copied, skipped };
}

// ---- Views for students, teachers and classes -------------------------------------

async function ownStudent(actor: AuthenticatedUser) {
  const result = await query<{ class_id: string; arm_id: string | null }>(
    `SELECT current_class_id AS class_id, arm_id FROM students
     WHERE user_id = $1 AND school_id = $2 AND enrollment_status = 'active'`,
    [actor.userId, actor.schoolId]
  );
  if (result.rowCount === 0) throw new NotFoundError("No active student record is linked to this account.");
  return result.rows[0];
}

export async function getStudentTimetable(actor: AuthenticatedUser) {
  const student = await ownStudent(actor);
  const period = await getCurrentPeriod(actor.schoolId);
  return listEntries(actor.schoolId, { classId: student.class_id, armId: student.arm_id ?? undefined, termId: period.termId ?? undefined });
}

const isoDay = (date: Date) => date.getDay() || 7;
const hhmm = (date: Date) => date.toTimeString().slice(0, 5);

export async function getStudentToday(actor: AuthenticatedUser, date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  const holiday = await query(
    `SELECT id, title, description FROM events
     WHERE school_id = $1 AND event_type = 'HOLIDAY' AND is_public AND start_date::date <= $2::date AND COALESCE(end_date, start_date)::date >= $2::date
     LIMIT 1`,
    [actor.schoolId, iso]
  );
  if (holiday.rows[0]) return { holiday: holiday.rows[0], message: "No classes today", schedule: [] };

  const dayOfWeek = isoDay(date);
  const schedule = (await getStudentTimetable(actor)).filter((entry) => Number(entry.day_of_week) === dayOfWeek);
  return { dayOfWeek, schedule };
}

export async function getStudentNextClass(actor: AuthenticatedUser, date = new Date()) {
  const today = await getStudentToday(actor, date);
  const now = hhmm(date);
  return (today.schedule as Array<Record<string, any>>).find((entry) => entry.start_time >= now && !entry.is_break) ?? null;
}

export function groupByDay(entries: Array<Record<string, any>>) {
  const week: Record<string, Array<Record<string, any>>> = {};
  for (const entry of entries) {
    const key = DAY_NAMES[Number(entry.day_of_week)] ?? String(entry.day_of_week);
    (week[key] ??= []).push(entry);
  }
  return week;
}

export async function getTeacherTimetable(actor: AuthenticatedUser) {
  return listEntries(actor.schoolId, { teacherId: actor.userId });
}
