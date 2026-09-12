import { withTransaction, query } from "../../db/pool";
import { RecordScoresInput } from "./scores.schemas";

const SCORE_SELECT = "id, school_id, assessment_id, student_id, score_obtained, entered_by_user_id, created_at, updated_at";

export async function listScores(schoolId: string, assessmentId: string) {
  const result = await query(
    `SELECT ${SCORE_SELECT} FROM scores WHERE school_id = $1 AND assessment_id = $2`,
    [schoolId, assessmentId]
  );
  return result.rows;
}

export async function recordScores(schoolId: string, enteredByUserId: string, input: RecordScoresInput) {
  await withTransaction(async (client) => {
    for (const score of input.scores) {
      await client.query(
        `INSERT INTO scores (school_id, assessment_id, student_id, score_obtained, entered_by_user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (school_id, assessment_id, student_id)
         DO UPDATE SET score_obtained = EXCLUDED.score_obtained, entered_by_user_id = EXCLUDED.entered_by_user_id, updated_at = NOW()`,
        [schoolId, input.assessmentId, score.studentId, score.scoreObtained, enteredByUserId]
      );
    }
  });

  return listScores(schoolId, input.assessmentId);
}
