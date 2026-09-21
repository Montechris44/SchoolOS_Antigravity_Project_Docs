import { PoolClient } from "pg";

import { UserRole, isAdminRole } from "../../config/rbac";
import { query, withTransaction } from "../../db/pool";
import {
  assertTeacherAssigned,
  assertTermEditable,
  getClassTeacherForArm,
  getTeacherHomeroom,
} from "../../shared/academics/period";
import { notifyStudentAndGuardians, notifyUser, notifyRoles } from "../../shared/academics/notifications";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/http/errors";
import { assertClassArm, assertOwned, assertTermSession } from "../../shared/security/ownership";
import { isSeniorSecondaryClass, ordinalSuffix } from "../../shared/text/names";
import { gradeForScore } from "../grading/grading.service";
import { generateClassReportCards } from "./report-cards.service";
import { EnterScoresInput, ResultScope, UpsertSchemeInput } from "./results.schemas";

export interface CaComponent {
  key: string;
  name: string;
  max_score: number;
}

export interface Actor {
  userId: string;
  schoolId: string;
  role: UserRole;
}

/** Batch states after which the subject teacher can no longer change scores. */
const LOCKED_BATCH_STATES = ["PENDING_REVIEW", "APPROVED", "PUBLISHED"];
/** States a subject may be in for the class teacher to submit the class to the administrator. */
const SUBMITTABLE_BATCH_STATES = ["PUBLISHED_TO_CLASS_TEACHER", "PENDING_REVIEW", "APPROVED", "PUBLISHED"];

const armCondition = (param: string, column = "arm_id") => `((${param}::uuid IS NULL AND ${column} IS NULL) OR ${column} = ${param})`;

function parseComponents(raw: unknown): CaComponent[] {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as CaComponent[];
}

/** A class that has arms is always worked on per arm; schools without arms use the class itself. */
async function assertScope(actor: Actor, scope: ResultScope): Promise<void> {
  await assertClassArm(actor.schoolId, scope.classId, scope.armId);
  await assertOwned(actor.schoolId, "subjects", scope.subjectId, "Subject");
  await assertTermSession(actor.schoolId, scope.termId, scope.sessionId);

  if (!scope.armId) {
    const arms = await query("SELECT 1 FROM class_arms WHERE class_id = $1 AND school_id = $2 LIMIT 1", [
      scope.classId,
      actor.schoolId,
    ]);
    if (arms.rowCount && arms.rowCount > 0) {
      throw new BadRequestError("This class has arms — choose the arm you are entering results for.");
    }
  }
}

// ---------------------------------------------------------------------------
// Subject teacher: CA scheme, scores, publish to class teacher
// ---------------------------------------------------------------------------

export async function getScheme(
  schoolId: string,
  params: { classId: string; armId?: string | null; subjectId: string; termId: string }
) {
  const result = await query(
    `SELECT * FROM teacher_assessment_schemes
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}
     LIMIT 1`,
    [schoolId, params.classId, params.subjectId, params.termId, params.armId ?? null]
  );
  const row = result.rows[0];
  return row ? { ...row, components: parseComponents(row.components), exam_max_score: Number(row.exam_max_score) } : null;
}

/** The subject teacher decides how the 100 marks are split; components plus exam must total exactly 100. */
export async function upsertScheme(actor: Actor, input: UpsertSchemeInput) {
  await assertScope(actor, input);
  await assertTermEditable(actor.schoolId, input.termId, actor.role);
  await assertTeacherAssigned(actor.schoolId, actor.userId, actor.role, input.classId, input.subjectId, input.armId);

  const components = input.components.map((component, index) => ({
    key: component.key ?? `ca${index + 1}`,
    name: component.name,
    max_score: component.maxScore,
  }));
  if (new Set(components.map((component) => component.key)).size !== components.length) {
    throw new BadRequestError("Each CA component needs a different key.");
  }

  const total = components.reduce((sum, component) => sum + component.max_score, 0) + input.examMaxScore;
  if (Math.abs(total - 100) > 0.01) {
    throw new BadRequestError(`CA components plus the exam must total 100 (currently ${total}).`);
  }

  const batch = await query<{ status: string }>(
    `SELECT status FROM subject_score_batches
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}`,
    [actor.schoolId, input.classId, input.subjectId, input.termId, input.armId ?? null]
  );
  if (batch.rows[0] && LOCKED_BATCH_STATES.includes(batch.rows[0].status)) {
    throw new ConflictError("This subject has been submitted for approval, so its scheme can no longer change.");
  }

  const existing = await query<{ id: string }>(
    `SELECT id FROM teacher_assessment_schemes
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}`,
    [actor.schoolId, input.classId, input.subjectId, input.termId, input.armId ?? null]
  );

  if (existing.rows[0]) {
    await query(
      `UPDATE teacher_assessment_schemes
       SET components = $1, exam_max_score = $2, teacher_id = $3, session_id = $4
       WHERE id = $5 AND school_id = $6`,
      [JSON.stringify(components), input.examMaxScore, actor.userId, input.sessionId, existing.rows[0].id, actor.schoolId]
    );
  } else {
    await query(
      `INSERT INTO teacher_assessment_schemes
         (school_id, teacher_id, class_id, arm_id, subject_id, term_id, session_id, components, exam_max_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        actor.schoolId,
        actor.userId,
        input.classId,
        input.armId ?? null,
        input.subjectId,
        input.termId,
        input.sessionId,
        JSON.stringify(components),
        input.examMaxScore,
      ]
    );
  }

  return getScheme(actor.schoolId, input);
}

async function ensureBatch(actor: Actor, scope: ResultScope) {
  const existing = await query<{ id: string; status: string }>(
    `SELECT id, status FROM subject_score_batches
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}`,
    [actor.schoolId, scope.classId, scope.subjectId, scope.termId, scope.armId ?? null]
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await query<{ id: string; status: string }>(
    `INSERT INTO subject_score_batches (school_id, class_id, arm_id, subject_id, term_id, session_id, teacher_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT') RETURNING id, status`,
    [actor.schoolId, scope.classId, scope.armId ?? null, scope.subjectId, scope.termId, scope.sessionId, actor.userId]
  );
  return created.rows[0];
}

/** Active students of exactly this class/arm. */
async function eligibleStudentIds(schoolId: string, classId: string, armId: string | null | undefined): Promise<Set<string>> {
  const result = await query<{ id: string }>(
    `SELECT id FROM students
     WHERE school_id = $1 AND current_class_id = $2 AND enrollment_status = 'active' AND ${armCondition("$3", "arm_id")}`,
    [schoolId, classId, armId ?? null]
  );
  return new Set(result.rows.map((row) => row.id));
}

/**
 * Saves CA and exam scores. Partial saves are fine; a subject total and grade exist only once every CA
 * component and the exam are filled in. Editing scores that were already handed to the class teacher flags
 * the batch for republishing and tells the class teacher what changed.
 */
export async function enterScores(actor: Actor, input: EnterScoresInput) {
  await assertScope(actor, input);
  await assertTermEditable(actor.schoolId, input.termId, actor.role);
  await assertTeacherAssigned(actor.schoolId, actor.userId, actor.role, input.classId, input.subjectId, input.armId);

  const scheme = await getScheme(actor.schoolId, input);
  if (!scheme) throw new BadRequestError("Define a CA scheme for this subject and term before entering scores.");

  const batch = await ensureBatch(actor, input);
  if (LOCKED_BATCH_STATES.includes(batch.status)) {
    throw new ConflictError(
      "These scores were submitted for approval and are locked. Ask the administrator to return the subject for correction."
    );
  }

  const eligible = await eligibleStudentIds(actor.schoolId, input.classId, input.armId);
  const unknown = input.scores.filter((row) => !eligible.has(row.studentId));
  if (unknown.length > 0) {
    throw new BadRequestError(`${unknown.length} student(s) do not belong to this class${input.armId ? " arm" : ""}.`);
  }

  const classTeacher = await getClassTeacherForArm(actor.schoolId, input.classId, input.armId);
  const wasPublished = batch.status === "PUBLISHED_TO_CLASS_TEACHER" || batch.status === "NEEDS_REPUBLISH";

  await withTransaction(async (client) => {
    for (const row of input.scores) {
      await saveStudentEntry(client, actor, input, scheme, row, batch.id, wasPublished ? classTeacher?.id ?? null : null);
    }

    if (wasPublished) {
      await client.query(
        `UPDATE subject_score_batches SET status = 'NEEDS_REPUBLISH', last_edited_at = NOW() WHERE id = $1`,
        [batch.id]
      );
    }
  });

  if (wasPublished && classTeacher) {
    await notifyUser(actor.schoolId, classTeacher.id, {
      type: "SCORES_EDITED",
      title: "Scores edited after publishing",
      message: "A subject teacher changed scores that were already submitted to you. Review the changes and wait for the republish.",
      entityType: "subject_score_batch",
      entityId: batch.id,
    });
  }

  return { batchId: batch.id, status: wasPublished ? "NEEDS_REPUBLISH" : batch.status, saved: input.scores.length };
}

async function saveStudentEntry(
  client: PoolClient,
  actor: Actor,
  scope: ResultScope,
  scheme: { components: CaComponent[]; exam_max_score: number },
  row: EnterScoresInput["scores"][number],
  batchId: string,
  auditForClassTeacher: string | null
) {
  const existingResult = await client.query<{ id: string }>(
    "SELECT id FROM results WHERE student_id = $1 AND term_id = $2 AND school_id = $3",
    [row.studentId, scope.termId, actor.schoolId]
  );
  let resultId = existingResult.rows[0]?.id;
  if (!resultId) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO results (school_id, student_id, class_id, arm_id, term_id, session_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [actor.schoolId, row.studentId, scope.classId, scope.armId ?? null, scope.termId, scope.sessionId]
    );
    resultId = created.rows[0].id;
  }

  let complete = true;
  let caSum = 0;
  const cleaned: Record<string, number | null> = {};
  for (const component of scheme.components) {
    const value = row.caComponents[component.key];
    if (value === null || value === undefined || Number.isNaN(value)) {
      complete = false;
      cleaned[component.key] = null;
      continue;
    }
    if (value < 0 || value > component.max_score) {
      throw new BadRequestError(`${component.name} must be between 0 and ${component.max_score}.`);
    }
    cleaned[component.key] = value;
    caSum += value;
  }

  const exam = row.examScore;
  if (exam === null || exam === undefined || Number.isNaN(exam)) {
    complete = false;
  } else if (exam < 0 || exam > scheme.exam_max_score) {
    throw new BadRequestError(`The exam score must be between 0 and ${scheme.exam_max_score}.`);
  }

  const total = complete ? caSum + (exam as number) : null;
  const grade = total !== null ? await gradeForScore(actor.schoolId, total, client) : { grade: "N/A", remark: "" };
  const subjectRemark = row.remark?.trim() || null;

  const previous = await client.query<{
    id: string;
    ca_components: unknown;
    exam_score: number;
    subject_remark: string | null;
    is_locked: boolean;
  }>("SELECT id, ca_components, exam_score, subject_remark, is_locked FROM result_entries WHERE result_id = $1 AND subject_id = $2", [
    resultId,
    scope.subjectId,
  ]);
  const before = previous.rows[0];
  if (before?.is_locked) throw new ConflictError("This entry is locked.");

  const saved = await client.query<{ id: string }>(
    `INSERT INTO result_entries
       (school_id, result_id, subject_id, teacher_id, ca_score, exam_score, grade, remark, subject_remark,
        ca_components, scores_complete, computed_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (result_id, subject_id) DO UPDATE SET
       ca_score = EXCLUDED.ca_score, exam_score = EXCLUDED.exam_score, grade = EXCLUDED.grade,
       remark = EXCLUDED.remark, subject_remark = EXCLUDED.subject_remark, teacher_id = EXCLUDED.teacher_id,
       ca_components = EXCLUDED.ca_components, scores_complete = EXCLUDED.scores_complete,
       computed_total = EXCLUDED.computed_total
     RETURNING id`,
    [
      actor.schoolId,
      resultId,
      scope.subjectId,
      actor.userId,
      complete ? caSum : 0,
      complete ? exam : 0,
      grade.grade,
      grade.remark,
      subjectRemark,
      JSON.stringify(cleaned),
      complete,
      total,
    ]
  );

  await client.query(
    `UPDATE results SET
       total_score = (SELECT COALESCE(SUM(computed_total), 0) FROM result_entries WHERE result_id = $1 AND scores_complete),
       average_score = (SELECT COALESCE(AVG(computed_total), 0) FROM result_entries WHERE result_id = $1 AND scores_complete)
     WHERE id = $1`,
    [resultId]
  );

  if (auditForClassTeacher && before) {
    const changed =
      JSON.stringify(before.ca_components ?? {}) !== JSON.stringify(cleaned) ||
      Number(before.exam_score) !== Number(exam ?? 0) ||
      (before.subject_remark ?? null) !== subjectRemark;
    if (changed) {
      await client.query(
        `INSERT INTO score_edit_audits
           (school_id, batch_id, result_entry_id, edited_by, class_teacher_id, class_id, arm_id, subject_id, term_id, student_id, changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          actor.schoolId,
          batchId,
          saved.rows[0].id,
          actor.userId,
          auditForClassTeacher,
          scope.classId,
          scope.armId ?? null,
          scope.subjectId,
          scope.termId,
          row.studentId,
          JSON.stringify({
            before: { caComponents: before.ca_components, examScore: before.exam_score, remark: before.subject_remark },
            after: { caComponents: cleaned, examScore: exam, remark: subjectRemark },
          }),
        ]
      );
    }
  }
}

export async function publishSubjectToClassTeacher(actor: Actor, scope: ResultScope) {
  await assertScope(actor, scope);
  await assertTermEditable(actor.schoolId, scope.termId, actor.role);
  await assertTeacherAssigned(actor.schoolId, actor.userId, actor.role, scope.classId, scope.subjectId, scope.armId);

  const classTeacher = await getClassTeacherForArm(actor.schoolId, scope.classId, scope.armId);
  if (!classTeacher) {
    throw new BadRequestError("No class teacher is assigned to this class. Ask the administrator to assign one before submitting.");
  }

  // Students with no result row at all count as missing, not as "fine".
  const incomplete = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id AND r.term_id = $3 AND r.school_id = s.school_id
     LEFT JOIN result_entries re ON re.result_id = r.id AND re.subject_id = $4
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active'
       AND ${armCondition("$5", "s.arm_id")}
       AND (re.id IS NULL OR re.scores_complete IS NOT TRUE)`,
    [actor.schoolId, scope.classId, scope.termId, scope.subjectId, scope.armId ?? null]
  );
  if (incomplete.rows[0].count > 0) {
    throw new BadRequestError(`${incomplete.rows[0].count} student(s) are still missing complete CA and exam scores.`);
  }

  const batch = await ensureBatch(actor, scope);
  const updated = await query(
    `UPDATE subject_score_batches
     SET status = 'PUBLISHED_TO_CLASS_TEACHER', published_at = NOW(), teacher_id = $2, review_notes = NULL
     WHERE id = $1 AND school_id = $3
       AND status IN ('DRAFT', 'NEEDS_REPUBLISH', 'PUBLISHED_TO_CLASS_TEACHER', 'RETURNED_FOR_CORRECTION')`,
    [batch.id, actor.userId, actor.schoolId]
  );
  if (updated.rowCount === 0) {
    throw new ConflictError("This subject is already with the administrator and cannot be published again.");
  }

  await notifyUser(actor.schoolId, classTeacher.id, {
    type: "SUBJECT_PUBLISHED",
    title: "Subject scores ready for your review",
    message: "A subject teacher has submitted scores for your class.",
    entityType: "subject_score_batch",
    entityId: batch.id,
  });
  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "results.subject_published",
    resourceType: "subject_score_batch",
    resourceId: batch.id,
  });

  return { batchId: batch.id, status: "PUBLISHED_TO_CLASS_TEACHER", classTeacherId: classTeacher.id };
}

/** The classes and subjects a teacher works on; administrators see every teaching assignment. */
export async function listMyClasses(actor: Actor) {
  const result = await query(
    `SELECT ta.id, ta.class_id, ta.arm_id, ta.subject_id, c.name AS class_name, ca.name AS arm_name,
            s.name AS subject_name, s.code AS subject_code,
            CASE WHEN ca.name IS NOT NULL THEN c.name || '-' || ca.name ELSE c.name END AS class_label
     FROM teacher_assignments ta
     JOIN classes c ON c.id = ta.class_id
     LEFT JOIN class_arms ca ON ca.id = ta.arm_id
     JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.school_id = $1 AND ta.is_active = TRUE AND ta.teacher_id IS NOT NULL
       AND ($2::boolean OR ta.teacher_id = $3)
     ORDER BY c.name, ca.name NULLS FIRST, s.name`,
    [actor.schoolId, isAdminRole(actor.role), actor.userId]
  );
  return result.rows;
}

/** Roster with scores, the scheme and the batch state in a single call — everything the entry screen needs. */
export async function getEntrySheet(actor: Actor, scope: ResultScope) {
  await assertScope(actor, scope);
  await assertTeacherAssigned(actor.schoolId, actor.userId, actor.role, scope.classId, scope.subjectId, scope.armId);

  const scheme = await getScheme(actor.schoolId, scope);
  const batch = await query<{ id: string; status: string; review_notes: string | null }>(
    `SELECT id, status, review_notes FROM subject_score_batches
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}`,
    [actor.schoolId, scope.classId, scope.subjectId, scope.termId, scope.armId ?? null]
  );

  const sheet = await query<Record<string, any>>(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name,
            re.id AS result_entry_id, re.ca_components, re.exam_score, re.scores_complete, re.computed_total,
            re.grade, re.remark AS grade_remark, re.subject_remark, COALESCE(re.is_locked, FALSE) AS is_locked
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id AND r.term_id = $2 AND r.school_id = s.school_id
     LEFT JOIN result_entries re ON re.result_id = r.id AND re.subject_id = $3
     WHERE s.school_id = $1 AND s.current_class_id = $4 AND s.enrollment_status = 'active'
       AND ${armCondition("$5", "s.arm_id")}
     ORDER BY s.last_name, s.first_name`,
    [actor.schoolId, scope.termId, scope.subjectId, scope.classId, scope.armId ?? null]
  );

  return {
    scheme,
    batch: batch.rows[0] ?? { id: null, status: "DRAFT", review_notes: null },
    students: withSubjectPositions(sheet.rows),
  };
}

/** Rank within one subject; equal totals share a position. */
function withSubjectPositions(rows: Array<Record<string, any>>) {
  const scored = rows
    .filter((row) => row.computed_total != null)
    .sort((a, b) => Number(b.computed_total) - Number(a.computed_total));
  const positions = new Map<string, number>();
  let last: number | null = null;
  let position = 0;
  scored.forEach((row, index) => {
    const score = Number(row.computed_total);
    if (score !== last) {
      position = index + 1;
      last = score;
    }
    positions.set(row.student_id, position);
  });

  return rows.map((row) => {
    const rank = positions.get(row.student_id);
    return {
      ...row,
      ca_components: typeof row.ca_components === "string" ? JSON.parse(row.ca_components) : (row.ca_components ?? {}),
      remark: row.subject_remark || row.grade_remark,
      subject_position: rank ?? null,
      subject_position_label: rank != null ? ordinalSuffix(rank) : "—",
    };
  });
}

// ---------------------------------------------------------------------------
// Class teacher
// ---------------------------------------------------------------------------

async function resolveRankingMode(schoolId: string, className: string): Promise<boolean> {
  const settings = await query<{ ranking_mode: string }>("SELECT ranking_mode FROM school_settings WHERE school_id = $1", [schoolId]);
  const mode = settings.rows[0]?.ranking_mode ?? "AUTO";
  if (mode === "SSS_GRADE_COUNTS") return true;
  if (mode === "AVERAGE") return false;
  return isSeniorSecondaryClass(className);
}

async function requireHomeroom(actor: Actor, scope?: { classId?: string | null; armId?: string | null }) {
  const home = await getTeacherHomeroom(actor.schoolId, actor.userId, scope);
  if (!home) throw new ForbiddenError("You are not assigned as a class teacher.");
  return home;
}

export async function getClassTeacherOverview(
  actor: Actor,
  params: { termId: string; sessionId?: string; classId?: string; armId?: string }
) {
  const home = await requireHomeroom(actor, params);

  const batches = await query(
    `SELECT b.id, b.class_id, b.arm_id, b.subject_id, b.term_id, b.session_id, b.teacher_id, b.status, b.published_at,
            b.review_notes, b.updated_at, sub.name AS subject_name, sub.code AS subject_code, p.full_name AS teacher_name,
            (SELECT COUNT(*)::int FROM students st
             WHERE st.school_id = b.school_id AND st.current_class_id = b.class_id AND st.enrollment_status = 'active'
               AND ${armCondition("b.arm_id", "st.arm_id")}) AS student_count
     FROM subject_score_batches b
     JOIN subjects sub ON sub.id = b.subject_id
     LEFT JOIN profiles p ON p.id = b.teacher_id
     WHERE b.school_id = $1 AND b.class_id = $2 AND b.term_id = $3 AND ${armCondition("$4", "b.arm_id")}
       AND ($5::uuid IS NULL OR b.session_id = $5)
     ORDER BY sub.name`,
    [actor.schoolId, home.classId, params.termId, home.armId, params.sessionId ?? null]
  );

  const assigned = await assignedSubjects(actor.schoolId, home.classId, home.armId);
  const started = new Set(batches.rows.map((row) => row.subject_id as string));
  const notStarted = assigned.filter((subject) => !started.has(subject.subject_id));

  const edits = await query(
    `SELECT a.id, a.created_at, a.changes, a.subject_id, a.student_id, sub.name AS subject_name,
            st.admission_number, st.first_name AS student_first_name, st.last_name AS student_last_name,
            ep.full_name AS editor_name
     FROM score_edit_audits a
     LEFT JOIN subjects sub ON sub.id = a.subject_id
     LEFT JOIN students st ON st.id = a.student_id
     LEFT JOIN profiles ep ON ep.id = a.edited_by
     WHERE a.school_id = $1 AND a.class_teacher_id = $2 AND a.term_id = $3
     ORDER BY a.created_at DESC LIMIT 100`,
    [actor.schoolId, actor.userId, params.termId]
  );

  let sessionId = params.sessionId;
  if (!sessionId) {
    const session = await query<{ session_id: string }>("SELECT session_id FROM terms WHERE id = $1 AND school_id = $2", [
      params.termId,
      actor.schoolId,
    ]);
    sessionId = session.rows[0]?.session_id;
  }
  const classSummary = sessionId
    ? await computeClassSummary(actor.schoolId, home.classId, home.armId, params.termId, sessionId)
    : [];

  const count = (...states: string[]) => batches.rows.filter((row) => states.includes(row.status)).length;
  const ready = count("PUBLISHED_TO_CLASS_TEACHER");
  const needsAttention = count("RETURNED_FOR_CORRECTION", "NEEDS_REPUBLISH", "DRAFT");

  return {
    homeroom: { ...home, classLabel: home.armName ? `${home.className}-${home.armName}` : home.className },
    batches: batches.rows.map((row) => ({ ...row, can_return: row.status === "PUBLISHED_TO_CLASS_TEACHER" })),
    notStarted,
    editAudits: edits.rows,
    classSummary,
    stats: {
      totalSubjects: assigned.length,
      readyForAdmin: ready,
      pendingAdmin: count("PENDING_REVIEW"),
      approved: count("APPROVED", "PUBLISHED"),
      needsAttention: needsAttention + notStarted.length,
      canSubmitToAdmin: assigned.length > 0 && notStarted.length === 0 && needsAttention === 0 && ready > 0,
    },
  };
}

async function assignedSubjects(schoolId: string, classId: string, armId: string | null) {
  const result = await query<{ subject_id: string; subject_name: string }>(
    `SELECT DISTINCT ta.subject_id, s.name AS subject_name
     FROM teacher_assignments ta JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.school_id = $1 AND ta.class_id = $2 AND ta.is_active = TRUE
       AND (ta.arm_id IS NULL OR ta.arm_id = $3::uuid)
       AND ($3::uuid IS NOT NULL OR ta.arm_id IS NULL)`,
    [schoolId, classId, armId]
  );
  return result.rows;
}

export async function getClassTeacherSubjectSheet(
  actor: Actor,
  params: { subjectId: string; termId: string; sessionId?: string; classId?: string; armId?: string }
) {
  const home = await requireHomeroom(actor, params);

  const batch = await query(
    `SELECT b.*, sub.name AS subject_name, sub.code AS subject_code, p.full_name AS teacher_name
     FROM subject_score_batches b
     JOIN subjects sub ON sub.id = b.subject_id
     LEFT JOIN profiles p ON p.id = b.teacher_id
     WHERE b.school_id = $1 AND b.class_id = $2 AND b.subject_id = $3 AND b.term_id = $4 AND ${armCondition("$5", "b.arm_id")}`,
    [actor.schoolId, home.classId, params.subjectId, params.termId, home.armId]
  );

  const scheme = await getScheme(actor.schoolId, {
    classId: home.classId,
    armId: home.armId,
    subjectId: params.subjectId,
    termId: params.termId,
  });

  const students = await query<Record<string, any>>(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name,
            re.id AS entry_id, re.ca_components, re.exam_score, re.computed_total, re.grade,
            re.remark AS grade_remark, re.subject_remark, re.scores_complete
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id AND r.term_id = $3 AND r.school_id = s.school_id
     LEFT JOIN result_entries re ON re.result_id = r.id AND re.subject_id = $4
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active' AND ${armCondition("$5", "s.arm_id")}
     ORDER BY s.last_name, s.first_name`,
    [actor.schoolId, home.classId, params.termId, params.subjectId, home.armId]
  );

  return {
    homeroom: home,
    batch: batch.rows[0] ?? null,
    scheme,
    students: withSubjectPositions(students.rows),
    readOnly: true,
    canReturn: batch.rows[0]?.status === "PUBLISHED_TO_CLASS_TEACHER",
  };
}

export async function classTeacherReturnSubject(
  actor: Actor,
  input: { subjectId?: string; termId?: string; batchId?: string; classId?: string; armId?: string | null; reviewNotes: string }
) {
  const home = await requireHomeroom(actor, input);

  const lookup = input.batchId
    ? await query(
        `SELECT * FROM subject_score_batches WHERE id = $1 AND school_id = $2 AND class_id = $3 AND ${armCondition("$4")}`,
        [input.batchId, actor.schoolId, home.classId, home.armId]
      )
    : await query(
        `SELECT * FROM subject_score_batches
         WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND term_id = $4 AND ${armCondition("$5")}`,
        [actor.schoolId, home.classId, input.subjectId ?? null, input.termId ?? null, home.armId]
      );
  const batch = lookup.rows[0];
  if (!batch) throw new NotFoundError("Subject batch not found.");

  await assertTermEditable(actor.schoolId, batch.term_id, actor.role);
  if (batch.status !== "PUBLISHED_TO_CLASS_TEACHER") {
    throw new ConflictError("Only subjects awaiting your review can be returned.");
  }

  await query(
    `UPDATE subject_score_batches
     SET status = 'RETURNED_FOR_CORRECTION', reviewed_at = NOW(), reviewed_by = $1, review_notes = $2
     WHERE id = $3 AND school_id = $4`,
    [actor.userId, input.reviewNotes.trim(), batch.id, actor.schoolId]
  );
  await notifyUser(actor.schoolId, batch.teacher_id, {
    type: "SUBJECT_RETURNED",
    title: "Scores returned by the class teacher",
    message: input.reviewNotes.trim(),
    entityType: "subject_score_batch",
    entityId: batch.id,
  });
  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "results.subject_returned_by_class_teacher",
    resourceType: "subject_score_batch",
    resourceId: batch.id,
  });

  return { batchId: batch.id, status: "RETURNED_FOR_CORRECTION" };
}

/** Live class summary for the class teacher: grand total, average and position, before anything is released. */
export async function computeClassSummary(
  schoolId: string,
  classId: string,
  armId: string | null,
  termId: string,
  sessionId: string
) {
  const cls = await query<{ name: string }>("SELECT name FROM classes WHERE id = $1 AND school_id = $2", [classId, schoolId]);
  const useGradeCounts = await resolveRankingMode(schoolId, cls.rows[0]?.name ?? "");

  const students = await query<RankableRow>(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name, r.id AS result_id,
            COALESCE((SELECT SUM(re.computed_total) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete), 0) AS grand_total,
            COALESCE((SELECT AVG(re.computed_total) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete), 0) AS avg_score,
            COALESCE((SELECT json_agg(UPPER(re.grade)) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete AND re.grade IS NOT NULL), '[]') AS grades
     FROM students s
     LEFT JOIN results r ON r.student_id = s.id AND r.term_id = $3 AND r.session_id = $5 AND r.school_id = s.school_id
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active' AND ${armCondition("$4", "s.arm_id")}`,
    [schoolId, classId, termId, armId, sessionId]
  );

  const ranked = rankStudents(students.rows, await gradeOrder(schoolId), useGradeCounts);
  return ranked.map((row, index) => ({
    studentId: row.student_id,
    admissionNumber: row.admission_number,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    grandTotal: row.grandTotal,
    average: Number(row.average.toFixed(1)),
    counts: row.counts,
    position: index + 1,
    positionLabel: ordinalSuffix(index + 1),
    positioningMode: useGradeCounts ? "SSS_GRADE_COUNTS" : "AVERAGE",
  }));
}

async function gradeOrder(schoolId: string): Promise<string[]> {
  const bands = await query<{ grade: string }>(
    "SELECT grade FROM grading_systems WHERE school_id = $1 ORDER BY max_score DESC, min_score DESC",
    [schoolId]
  );
  const letters = bands.rows.map((band) => band.grade.toUpperCase());
  return [...new Set(letters.length ? letters : ["A", "B", "C", "D", "E", "F"])];
}

interface RankableRow {
  student_id: string;
  first_name: string;
  last_name: string;
  grand_total: number | string;
  avg_score: number | string;
  grades: unknown;
  admission_number?: string;
  result_id?: string | null;
}

/** Primary/JSS: average, then grand total, then name. SSS: most A's, then B's… (school grade order), then the same. */
function rankStudents(rows: RankableRow[], order: string[], useGradeCounts: boolean) {
  const ranked = rows.map((row) => {
    const grades: string[] = typeof row.grades === "string" ? JSON.parse(row.grades) : ((row.grades as string[]) ?? []);
    const counts: Record<string, number> = {};
    for (const grade of order) counts[grade] = 0;
    for (const grade of grades) counts[grade] = (counts[grade] ?? 0) + 1;
    return {
      ...row,
      counts,
      average: Number(row.avg_score ?? 0),
      grandTotal: Number(row.grand_total ?? 0),
      sortName: `${row.last_name ?? ""} ${row.first_name ?? ""}`.toLowerCase(),
    };
  });

  ranked.sort((a, b) => {
    if (useGradeCounts) {
      for (const grade of order) {
        const diff = (b.counts[grade] ?? 0) - (a.counts[grade] ?? 0);
        if (diff !== 0) return diff;
      }
    }
    return b.average - a.average || b.grandTotal - a.grandTotal || a.sortName.localeCompare(b.sortName);
  });
  return ranked;
}

export async function classTeacherPublishToAdmin(
  actor: Actor,
  input: { termId: string; sessionId: string; classId?: string; armId?: string | null; teacherRemark?: string }
) {
  await assertTermEditable(actor.schoolId, input.termId, actor.role);
  await assertTermSession(actor.schoolId, input.termId, input.sessionId);
  const home = await requireHomeroom(actor, input);

  const batches = await query<{ subject_id: string; status: string }>(
    `SELECT subject_id, status FROM subject_score_batches
     WHERE school_id = $1 AND class_id = $2 AND term_id = $3 AND session_id = $4 AND ${armCondition("$5")}`,
    [actor.schoolId, home.classId, input.termId, input.sessionId, home.armId]
  );

  // Every subject taught to this class must have been started and published — a subject nobody entered
  // scores for must not slip through to the administrator.
  const assigned = await assignedSubjects(actor.schoolId, home.classId, home.armId);
  const byStatus = new Map(batches.rows.map((row) => [row.subject_id, row.status]));
  const missing = assigned.filter((subject) => !SUBMITTABLE_BATCH_STATES.includes(byStatus.get(subject.subject_id) ?? ""));
  if (missing.length > 0) {
    throw new BadRequestError(
      `These subjects are not ready: ${missing.map((subject) => subject.subject_name).join(", ")}. All subjects must be published (and republished after edits).`
    );
  }

  const toSubmit = batches.rows.filter((row) => row.status === "PUBLISHED_TO_CLASS_TEACHER").length;
  if (toSubmit === 0) {
    throw new BadRequestError("There are no newly published subjects to submit. Fix returned subjects and republish first.");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE subject_score_batches
       SET status = 'PENDING_REVIEW', submitted_to_admin_at = NOW(), submitted_to_admin_by = $1, review_notes = NULL
       WHERE school_id = $2 AND class_id = $3 AND term_id = $4 AND session_id = $5 AND ${armCondition("$6")}
         AND status = 'PUBLISHED_TO_CLASS_TEACHER'`,
      [actor.userId, actor.schoolId, home.classId, input.termId, input.sessionId, home.armId]
    );
    await client.query(
      `UPDATE results
       SET approval_status = 'PENDING_REVIEW', submitted_at = NOW(), submitted_by = $1,
           class_teacher_submitted_at = NOW(), class_teacher_submitted_by = $1,
           teacher_remark = COALESCE($6, teacher_remark), correction_reason = NULL
       WHERE school_id = $2 AND class_id = $3 AND term_id = $4 AND session_id = $7 AND ${armCondition("$5", "arm_id")}
         AND approval_status IN ('DRAFT', 'RETURNED_FOR_CORRECTION', 'SUBMITTED_FOR_APPROVAL', 'PENDING_REVIEW')`,
      [actor.userId, actor.schoolId, home.classId, input.termId, home.armId, input.teacherRemark ?? null, input.sessionId]
    );
  });

  await notifyRoles(actor.schoolId, ["owner", "admin"], {
    type: "CLASS_SUBMITTED",
    title: "Class results submitted for approval",
    message: `${home.className}${home.armName ? `-${home.armName}` : ""} results are waiting in the approval queue.`,
    entityType: "class",
    entityId: home.classId,
  });
  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "results.class_submitted",
    resourceType: "class",
    resourceId: home.classId,
    payload: { termId: input.termId, armId: home.armId },
  });

  return { submittedSubjects: toSubmit };
}

// ---------------------------------------------------------------------------
// School administrator: approval queue and release
// ---------------------------------------------------------------------------

const QUEUE_STATUS: Record<string, string> = {
  pending: "b.status = 'PENDING_REVIEW'",
  approved: "b.status = 'APPROVED'",
  released: "b.status = 'PUBLISHED'",
  returned: "b.status = 'RETURNED_FOR_CORRECTION'",
};

const queueLabel = (status: string) =>
  ({ PENDING_REVIEW: "PENDING", APPROVED: "APPROVED", PUBLISHED: "RELEASED", RETURNED_FOR_CORRECTION: "RETURNED" })[status] ?? "OTHER";

export async function getApprovalQueue(
  schoolId: string,
  params: { sessionId?: string; termId?: string; classId?: string; status?: string; search?: string }
) {
  const statusClause =
    QUEUE_STATUS[params.status ?? "all"] ?? "b.status IN ('PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'RETURNED_FOR_CORRECTION')";

  const result = await query<Record<string, any>>(
    `SELECT b.id, b.class_id, b.arm_id, b.subject_id, b.term_id, b.session_id, b.teacher_id, b.status, b.published_at,
            b.submitted_to_admin_at, b.reviewed_at, b.approved_at, b.review_notes, b.released_at,
            sub.name AS subject_name, sub.code AS subject_code, c.name AS class_name, a.name AS arm_name,
            t.name AS term_name, sess.name AS session_name, tp.full_name AS teacher_name, sp.full_name AS submitted_by_name,
            (SELECT COUNT(*)::int FROM result_entries re JOIN results r ON r.id = re.result_id
             WHERE r.school_id = b.school_id AND r.class_id = b.class_id AND r.term_id = b.term_id AND r.session_id = b.session_id
               AND ${armCondition("b.arm_id", "r.arm_id")} AND re.subject_id = b.subject_id AND re.scores_complete) AS students_count
     FROM subject_score_batches b
     JOIN subjects sub ON sub.id = b.subject_id
     JOIN classes c ON c.id = b.class_id
     LEFT JOIN class_arms a ON a.id = b.arm_id
     JOIN terms t ON t.id = b.term_id
     JOIN academic_sessions sess ON sess.id = b.session_id
     LEFT JOIN profiles tp ON tp.id = b.teacher_id
     LEFT JOIN profiles sp ON sp.id = b.submitted_to_admin_by
     WHERE b.school_id = $1
       AND ($2::uuid IS NULL OR b.session_id = $2) AND ($3::uuid IS NULL OR b.term_id = $3) AND ($4::uuid IS NULL OR b.class_id = $4)
       AND ${statusClause}
       AND ($5::text IS NULL OR sub.name ILIKE '%' || $5 || '%' OR sub.code ILIKE '%' || $5 || '%' OR tp.full_name ILIKE '%' || $5 || '%')
     ORDER BY COALESCE(b.submitted_to_admin_at, b.published_at, b.updated_at) DESC`,
    [schoolId, params.sessionId ?? null, params.termId ?? null, params.classId ?? null, params.search || null]
  );

  return result.rows.map((row) => ({
    ...row,
    queue_status: queueLabel(row.status),
    class_label: row.arm_name ? `${row.class_name}-${row.arm_name}` : row.class_name,
    term_session_label: `${row.term_name} · ${row.session_name}`,
  }));
}

export async function getApprovalQueueMetrics(schoolId: string, params: { sessionId?: string; termId?: string; classId?: string }) {
  const result = await query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'RETURNED_FOR_CORRECTION'))::int AS total_submissions,
            COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_review,
            COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS released
     FROM subject_score_batches
     WHERE school_id = $1 AND ($2::uuid IS NULL OR session_id = $2) AND ($3::uuid IS NULL OR term_id = $3) AND ($4::uuid IS NULL OR class_id = $4)`,
    [schoolId, params.sessionId ?? null, params.termId ?? null, params.classId ?? null]
  );
  return result.rows[0];
}

export async function getClassPublishReadiness(
  schoolId: string,
  classId: string,
  armId: string | null,
  termId: string,
  sessionId: string
) {
  const counts = await query<Record<string, number>>(
    `SELECT COUNT(*)::int AS total_subjects,
            COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_subjects,
            COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published_subjects,
            COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending_subjects,
            COUNT(*) FILTER (WHERE status = 'RETURNED_FOR_CORRECTION')::int AS returned_subjects
     FROM subject_score_batches
     WHERE school_id = $1 AND class_id = $2 AND term_id = $3 AND session_id = $4 AND ${armCondition("$5")}
       AND status IN ('PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'RETURNED_FOR_CORRECTION', 'PUBLISHED_TO_CLASS_TEACHER')`,
    [schoolId, classId, termId, sessionId, armId]
  );
  const row = counts.rows[0];
  return {
    totalSubjects: row.total_subjects,
    approvedSubjects: row.approved_subjects,
    publishedSubjects: row.published_subjects,
    pendingSubjects: row.pending_subjects,
    returnedSubjects: row.returned_subjects,
    canPublish: row.total_subjects > 0 && row.approved_subjects === row.total_subjects && row.published_subjects === 0,
    alreadyReleased: row.total_subjects > 0 && row.published_subjects === row.total_subjects,
  };
}

export async function getApprovalBatchDetail(schoolId: string, batchId: string) {
  const batchRes = await query<Record<string, any>>(
    `SELECT b.*, sub.name AS subject_name, sub.code AS subject_code, c.name AS class_name, a.name AS arm_name,
            t.name AS term_name, sess.name AS session_name, tp.full_name AS teacher_name, sp.full_name AS submitted_by_name
     FROM subject_score_batches b
     JOIN subjects sub ON sub.id = b.subject_id
     JOIN classes c ON c.id = b.class_id
     LEFT JOIN class_arms a ON a.id = b.arm_id
     JOIN terms t ON t.id = b.term_id
     JOIN academic_sessions sess ON sess.id = b.session_id
     LEFT JOIN profiles tp ON tp.id = b.teacher_id
     LEFT JOIN profiles sp ON sp.id = b.submitted_to_admin_by
     WHERE b.id = $1 AND b.school_id = $2`,
    [batchId, schoolId]
  );
  const batch = batchRes.rows[0];
  if (!batch) throw new NotFoundError("Submission not found.");

  const scheme = await getScheme(schoolId, {
    classId: batch.class_id,
    armId: batch.arm_id,
    subjectId: batch.subject_id,
    termId: batch.term_id,
  });
  const bands = await query(
    "SELECT grade, min_score, max_score, remark FROM grading_systems WHERE school_id = $1 ORDER BY min_score DESC",
    [schoolId]
  );

  const students = await query<Record<string, any>>(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name, re.id AS entry_id, re.ca_components,
            re.exam_score, re.computed_total, re.grade, re.remark, re.scores_complete
     FROM students s
     JOIN results r ON r.student_id = s.id AND r.term_id = $3 AND r.school_id = s.school_id
     JOIN result_entries re ON re.result_id = r.id AND re.subject_id = $4
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active' AND ${armCondition("$5", "s.arm_id")}
     ORDER BY re.computed_total DESC NULLS LAST, s.last_name, s.first_name`,
    [schoolId, batch.class_id, batch.term_id, batch.subject_id, batch.arm_id]
  );

  return {
    batch: {
      ...batch,
      queue_status: queueLabel(batch.status),
      class_label: batch.arm_name ? `${batch.class_name}-${batch.arm_name}` : batch.class_name,
    },
    scheme,
    gradingScheme: bands.rows,
    students: withSubjectPositions(students.rows),
    publishReadiness: await getClassPublishReadiness(schoolId, batch.class_id, batch.arm_id, batch.term_id, batch.session_id),
  };
}

export async function approveSubjectBatch(schoolId: string, adminId: string, batchId: string) {
  const found = await query<Record<string, any>>("SELECT * FROM subject_score_batches WHERE id = $1 AND school_id = $2", [batchId, schoolId]);
  const batch = found.rows[0];
  if (!batch) throw new NotFoundError("Submission not found.");
  if (batch.status !== "PENDING_REVIEW") {
    throw new ConflictError("Only submissions that are pending review can be approved.");
  }

  await query(
    `UPDATE subject_score_batches
     SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = $1, approved_at = NOW(), approved_by = $1, review_notes = NULL
     WHERE id = $2 AND school_id = $3`,
    [adminId, batchId, schoolId]
  );

  const readiness = await getClassPublishReadiness(schoolId, batch.class_id, batch.arm_id, batch.term_id, batch.session_id);
  if (readiness.canPublish) {
    await query(
      `UPDATE results SET approval_status = 'APPROVED', approved_at = NOW(), approved_by = $1, reviewed_at = NOW(), reviewed_by = $1
       WHERE school_id = $2 AND class_id = $3 AND term_id = $4 AND session_id = $5 AND ${armCondition("$6", "arm_id")}
         AND approval_status IN ('PENDING_REVIEW', 'RETURNED_FOR_CORRECTION')`,
      [adminId, schoolId, batch.class_id, batch.term_id, batch.session_id, batch.arm_id]
    );
  }

  if (batch.submitted_to_admin_by) {
    await notifyUser(schoolId, batch.submitted_to_admin_by, {
      type: "SUBJECT_APPROVED",
      title: "Subject approved",
      message: "The administrator approved a subject you submitted.",
      entityType: "subject_score_batch",
      entityId: batchId,
    });
  }
  await recordAuditLog({ schoolId, userId: adminId, action: "results.subject_approved", resourceType: "subject_score_batch", resourceId: batchId });

  return { batchId, status: "APPROVED", publishReadiness: readiness };
}

export async function returnSubjectBatch(schoolId: string, adminId: string, batchId: string, reviewNotes: string) {
  const found = await query<Record<string, any>>("SELECT * FROM subject_score_batches WHERE id = $1 AND school_id = $2", [batchId, schoolId]);
  const batch = found.rows[0];
  if (!batch) throw new NotFoundError("Submission not found.");
  if (batch.status !== "PENDING_REVIEW" && batch.status !== "APPROVED") {
    throw new ConflictError("Only submissions that are pending review or approved (and not yet released) can be returned.");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE subject_score_batches
       SET status = 'RETURNED_FOR_CORRECTION', reviewed_at = NOW(), reviewed_by = $1, review_notes = $2,
           approved_at = NULL, approved_by = NULL
       WHERE id = $3 AND school_id = $4`,
      [adminId, reviewNotes.trim(), batchId, schoolId]
    );
    // One returned subject keeps the whole class out of the approved state.
    await client.query(
      `UPDATE results
       SET approval_status = 'RETURNED_FOR_CORRECTION', correction_reason = $1, reviewed_at = NOW(), reviewed_by = $2,
           approved_at = NULL, approved_by = NULL
       WHERE school_id = $3 AND class_id = $4 AND term_id = $5 AND session_id = $6 AND ${armCondition("$7", "arm_id")}
         AND approval_status IN ('PENDING_REVIEW', 'APPROVED')`,
      [reviewNotes.trim(), adminId, schoolId, batch.class_id, batch.term_id, batch.session_id, batch.arm_id]
    );
  });

  for (const recipient of new Set([batch.submitted_to_admin_by, batch.teacher_id].filter(Boolean) as string[])) {
    await notifyUser(schoolId, recipient, {
      type: "RESULT_RETURNED",
      title: "Results returned for correction",
      message: reviewNotes.trim(),
      entityType: "subject_score_batch",
      entityId: batchId,
    });
  }
  await recordAuditLog({ schoolId, userId: adminId, action: "results.subject_returned_by_admin", resourceType: "subject_score_batch", resourceId: batchId });

  return { batchId, status: "RETURNED_FOR_CORRECTION" };
}

/** Releases a class to students and parents once every subject is approved; positions are fixed at this moment. */
export async function publishClassWhenAllApproved(
  schoolId: string,
  adminId: string,
  data: { classId: string; armId?: string | null; termId: string; sessionId: string; principalRemark?: string }
) {
  await assertClassArm(schoolId, data.classId, data.armId);
  await assertTermSession(schoolId, data.termId, data.sessionId);

  const armId = data.armId ?? null;
  const readiness = await getClassPublishReadiness(schoolId, data.classId, armId, data.termId, data.sessionId);
  if (readiness.alreadyReleased) throw new ConflictError("Results for this class are already released.");
  if (!readiness.canPublish) {
    throw new BadRequestError(
      `Cannot release yet: ${readiness.approvedSubjects}/${readiness.totalSubjects} subjects approved. Every subject must be approved first.`
    );
  }

  await calculatePositionsForClass(schoolId, data.classId, armId, data.termId, data.sessionId);

  const published = await withTransaction(async (client) => {
    await client.query(
      `UPDATE subject_score_batches SET status = 'PUBLISHED', released_at = NOW(), released_by = $1
       WHERE school_id = $2 AND class_id = $3 AND term_id = $4 AND session_id = $5 AND ${armCondition("$6")} AND status = 'APPROVED'`,
      [adminId, schoolId, data.classId, data.termId, data.sessionId, armId]
    );
    const result = await client.query<{ id: string; student_id: string }>(
      `UPDATE results
       SET approval_status = 'PUBLISHED', status = 'PUBLISHED', published_at = NOW(), published_by = $1,
           principal_remark = COALESCE($2, principal_remark)
       WHERE school_id = $3 AND class_id = $4 AND term_id = $5 AND session_id = $6 AND ${armCondition("$7", "arm_id")}
         AND approval_status IN ('APPROVED', 'PENDING_REVIEW')
       RETURNING id, student_id`,
      [adminId, data.principalRemark ?? null, schoolId, data.classId, data.termId, data.sessionId, armId]
    );
    return result.rows;
  });

  await generateClassReportCards(schoolId, data.classId, armId, data.termId, data.sessionId);

  for (const row of published) {
    await notifyStudentAndGuardians(schoolId, row.student_id, {
      type: "RESULT_PUBLISHED",
      title: "Results published",
      message: "Your term results are now available.",
      entityType: "result",
      entityId: row.id,
    });
  }
  await recordAuditLog({
    schoolId,
    userId: adminId,
    action: "results.class_released",
    resourceType: "class",
    resourceId: data.classId,
    payload: { termId: data.termId, armId, students: published.length },
  });

  return { publishedCount: published.length, readiness };
}

/**
 * Fixes each student's position: Primary/JSS by average, then grand total, then name; Senior Secondary by grade
 * counts first. Also settles the totals and pass/fail counts that appear on the report card.
 */
export async function calculatePositionsForClass(
  schoolId: string,
  classId: string,
  armId: string | null,
  termId: string,
  sessionId: string
) {
  const cls = await query<{ name: string }>("SELECT name FROM classes WHERE id = $1 AND school_id = $2", [classId, schoolId]);
  const useGradeCounts = await resolveRankingMode(schoolId, cls.rows[0]?.name ?? "");
  const order = await gradeOrder(schoolId);
  const passMark = Number(
    (await query<{ pass_mark: number }>("SELECT pass_mark FROM school_settings WHERE school_id = $1", [schoolId])).rows[0]?.pass_mark ?? 50
  );

  const students = await query<RankableRow>(
    `SELECT r.id AS result_id, r.student_id, s.first_name, s.last_name,
            COALESCE((SELECT SUM(re.computed_total) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete), 0) AS grand_total,
            COALESCE((SELECT AVG(re.computed_total) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete), 0) AS avg_score,
            COALESCE((SELECT json_agg(UPPER(re.grade)) FROM result_entries re WHERE re.result_id = r.id AND re.scores_complete AND re.grade IS NOT NULL), '[]') AS grades
     FROM results r JOIN students s ON s.id = r.student_id
     WHERE r.school_id = $1 AND r.class_id = $2 AND r.term_id = $3 AND r.session_id = $4 AND ${armCondition("$5", "r.arm_id")}`,
    [schoolId, classId, termId, sessionId, armId]
  );

  const ranked = rankStudents(students.rows, order, useGradeCounts);
  const size = ranked.length;

  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM class_rankings WHERE school_id = $1 AND class_id = $2 AND term_id = $3 AND session_id = $4 AND ${armCondition("$5", "arm_id")}`,
      [schoolId, classId, termId, sessionId, armId]
    );

    for (let index = 0; index < ranked.length; index += 1) {
      const row = ranked[index];
      const position = index + 1;
      const suffix = ordinalSuffix(position);

      const totals = await client.query<{ total: number; passed: number; failed: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE computed_total >= $2)::int AS passed,
                COUNT(*) FILTER (WHERE computed_total < $2)::int AS failed
         FROM result_entries WHERE result_id = $1 AND scores_complete`,
        [row.result_id, passMark]
      );

      await client.query(
        `UPDATE results
         SET position = $1, position_suffix = $2, class_size = $3, total_score = $4, average_score = $5, grade_counts = $6,
             total_subjects = $8, passed_subjects = $9, failed_subjects = $10
         WHERE id = $7`,
        [
          position,
          suffix,
          size,
          row.grandTotal,
          row.average,
          JSON.stringify(row.counts),
          row.result_id,
          totals.rows[0].total,
          totals.rows[0].passed,
          totals.rows[0].failed,
        ]
      );
      await client.query(
        `INSERT INTO class_rankings
           (school_id, class_id, arm_id, term_id, session_id, student_id, position, position_suffix, total_score, average_score, total_subjects)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [schoolId, classId, armId, termId, sessionId, row.student_id, position, suffix, row.grandTotal, row.average, totals.rows[0].total]
      );
    }
  });
}
