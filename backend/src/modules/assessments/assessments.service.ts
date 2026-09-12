import { query } from "../../db/pool";
import { getCurrentTermId } from "../terms/terms.service";
import { CreateAssessmentInput } from "./assessments.schemas";

const ASSESSMENT_SELECT = "id, school_id, class_id, subject_id, term_id, name, type, max_score, weight_percentage";

export async function listAssessments(schoolId: string, classId?: string, subjectId?: string) {
  const conditions = ["school_id = $1"];
  const params: unknown[] = [schoolId];

  if (classId) {
    params.push(classId);
    conditions.push(`class_id = $${params.length}`);
  }
  if (subjectId) {
    params.push(subjectId);
    conditions.push(`subject_id = $${params.length}`);
  }

  const result = await query(
    `SELECT ${ASSESSMENT_SELECT} FROM assessments WHERE ${conditions.join(" AND ")} ORDER BY name ASC`,
    params
  );
  return result.rows;
}

export async function createAssessment(schoolId: string, input: CreateAssessmentInput) {
  const termId = input.termId ?? (await getCurrentTermId(schoolId));

  const result = await query(
    `INSERT INTO assessments (school_id, class_id, subject_id, term_id, name, type, max_score, weight_percentage)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${ASSESSMENT_SELECT}`,
    [schoolId, input.classId, input.subjectId, termId, input.name, input.type, input.maxScore, input.weightPercentage]
  );

  return result.rows[0];
}
