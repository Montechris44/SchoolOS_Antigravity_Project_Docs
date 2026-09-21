import { query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";

const armCondition = (param: string, column: string) => `((${param}::uuid IS NULL AND ${column} IS NULL) OR ${column} = ${param})`;

/**
 * Report cards are snapshots taken when the administrator releases a class: totals, position, pass/fail counts and
 * remarks are frozen at that moment, so later edits elsewhere never silently change a card a parent has already seen.
 */
export async function generateClassReportCards(
  schoolId: string,
  classId: string,
  armId: string | null,
  termId: string,
  sessionId: string
): Promise<number> {
  const nextTerm = await query<{ start_date: string; end_date: string }>(
    `SELECT n.start_date, t.end_date
     FROM terms t
     LEFT JOIN LATERAL (
       SELECT start_date FROM terms WHERE school_id = t.school_id AND start_date > t.end_date ORDER BY start_date LIMIT 1
     ) n ON TRUE
     WHERE t.id = $1 AND t.school_id = $2`,
    [termId, schoolId]
  );

  const result = await query(
    `INSERT INTO report_cards
       (school_id, student_id, result_id, term_id, session_id, class_id, arm_id, total_score, average_score, position, position_suffix,
        class_size, total_subjects, passed_subjects, failed_subjects, teacher_remark, principal_remark, next_term_begins, term_ending_date)
     SELECT r.school_id, r.student_id, r.id, r.term_id, r.session_id, r.class_id, r.arm_id, r.total_score, r.average_score,
            r.position, r.position_suffix, r.class_size, r.total_subjects, r.passed_subjects, r.failed_subjects,
            r.teacher_remark, r.principal_remark, $6::date, $7::date
     FROM results r
     WHERE r.school_id = $1 AND r.class_id = $2 AND r.term_id = $3 AND r.session_id = $4 AND ${armCondition("$5", "r.arm_id")}
       AND r.approval_status = 'PUBLISHED'
     ON CONFLICT (student_id, term_id) DO UPDATE SET
       result_id = EXCLUDED.result_id, total_score = EXCLUDED.total_score, average_score = EXCLUDED.average_score,
       position = EXCLUDED.position, position_suffix = EXCLUDED.position_suffix, class_size = EXCLUDED.class_size,
       total_subjects = EXCLUDED.total_subjects, passed_subjects = EXCLUDED.passed_subjects,
       failed_subjects = EXCLUDED.failed_subjects, teacher_remark = EXCLUDED.teacher_remark,
       principal_remark = EXCLUDED.principal_remark, next_term_begins = EXCLUDED.next_term_begins,
       term_ending_date = EXCLUDED.term_ending_date`,
    [schoolId, classId, termId, sessionId, armId, nextTerm.rows[0]?.start_date ?? null, nextTerm.rows[0]?.end_date ?? null]
  );
  return result.rowCount ?? 0;
}

/** Full report card for a published result. Only ever built from published results. */
export async function getReportCard(schoolId: string, studentId: string, termId: string) {
  let card = await query<Record<string, any>>(
    `SELECT rc.*, c.name AS class_name, ca.name AS arm_name, t.name AS term_name, t.start_date AS term_start_date,
            sess.name AS session_name
     FROM report_cards rc
     JOIN classes c ON c.id = rc.class_id
     LEFT JOIN class_arms ca ON ca.id = rc.arm_id
     JOIN terms t ON t.id = rc.term_id
     JOIN academic_sessions sess ON sess.id = rc.session_id
     WHERE rc.school_id = $1 AND rc.student_id = $2 AND rc.term_id = $3`,
    [schoolId, studentId, termId]
  );

  if (card.rowCount === 0) {
    // Results published before report cards existed (or a card that was cleaned up): build it on demand.
    const published = await query<{ class_id: string; arm_id: string | null; session_id: string }>(
      `SELECT class_id, arm_id, session_id FROM results
       WHERE school_id = $1 AND student_id = $2 AND term_id = $3 AND approval_status = 'PUBLISHED'`,
      [schoolId, studentId, termId]
    );
    if (published.rowCount === 0) throw new NotFoundError("No published report card for this term yet.");
    const scope = published.rows[0];
    await generateClassReportCards(schoolId, scope.class_id, scope.arm_id, termId, scope.session_id);
    return getReportCard(schoolId, studentId, termId);
  }

  const row = card.rows[0];
  const [school, student, subjects, bands] = await Promise.all([
    query("SELECT name, logo_url, address, city, state, phone, email, theme_color FROM schools WHERE id = $1", [schoolId]),
    query(
      `SELECT id, admission_number, first_name, last_name, middle_name, gender, date_of_birth, photo_url FROM students WHERE id = $1 AND school_id = $2`,
      [studentId, schoolId]
    ),
    query(
      `SELECT sub.name AS subject_name, sub.code AS subject_code, re.ca_components, re.ca_score, re.exam_score,
              re.computed_total AS total_score, re.grade, re.remark AS grade_remark, re.subject_remark, p.full_name AS teacher_name
       FROM result_entries re
       JOIN subjects sub ON sub.id = re.subject_id
       LEFT JOIN profiles p ON p.id = re.teacher_id
       WHERE re.result_id = $1 AND re.scores_complete
       ORDER BY sub.name`,
      [row.result_id]
    ),
    query("SELECT grade, min_score, max_score, remark FROM grading_systems WHERE school_id = $1 ORDER BY min_score DESC", [schoolId]),
  ]);

  return {
    ...row,
    school: school.rows[0],
    student: student.rows[0],
    subjects: subjects.rows.map((subject) => ({
      ...subject,
      ca_components: typeof subject.ca_components === "string" ? JSON.parse(subject.ca_components) : subject.ca_components,
    })),
    grading_scale: bands.rows,
  };
}
