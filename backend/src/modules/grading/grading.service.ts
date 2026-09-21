import { PoolClient } from "pg";

import { pool, query, withTransaction } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { BadRequestError } from "../../shared/http/errors";

export interface GradeBand {
  minScore: number;
  maxScore: number;
  grade: string;
  remark?: string | null;
  isPass: boolean;
}

type Executor = Pick<PoolClient, "query"> | typeof pool;

export async function listGradeBands(schoolId: string) {
  const result = await query(
    `SELECT id, min_score, max_score, grade, remark, is_pass
     FROM grading_systems WHERE school_id = $1 ORDER BY min_score DESC`,
    [schoolId]
  );
  return result.rows;
}

/** Grade for a subject total; "N/A" when the score falls outside every band. */
export async function gradeForScore(
  schoolId: string,
  score: number,
  client: Executor = pool
): Promise<{ grade: string; remark: string; isPass: boolean }> {
  const result = await client.query<{ grade: string; remark: string | null; is_pass: boolean }>(
    `SELECT grade, remark, is_pass FROM grading_systems
     WHERE school_id = $1 AND $2::numeric >= min_score AND $2::numeric <= max_score
     ORDER BY min_score DESC LIMIT 1`,
    [schoolId, score]
  );
  const row = result.rows[0];
  return row ? { grade: row.grade, remark: row.remark ?? "", isPass: row.is_pass } : { grade: "N/A", remark: "", isPass: false };
}

/**
 * Bands must not overlap and must span 0–100 without gaps larger than the two-decimal step used by
 * WAEC-style scales (e.g. 74.99 → 75), otherwise some scores would be left without a grade.
 */
export function validateBands(bands: GradeBand[]): void {
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);

  if (sorted[0].minScore !== 0) throw new BadRequestError("The lowest band must start at 0.");
  if (sorted[sorted.length - 1].maxScore !== 100) throw new BadRequestError("The highest band must end at 100.");

  const grades = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    if (band.minScore > band.maxScore) throw new BadRequestError(`Band ${band.grade}: minimum is above maximum.`);
    if (grades.has(band.grade.toUpperCase())) throw new BadRequestError(`Grade ${band.grade} is listed twice.`);
    grades.add(band.grade.toUpperCase());

    const next = sorted[i + 1];
    if (!next) continue;
    if (next.minScore <= band.maxScore) {
      throw new BadRequestError(`Bands ${band.grade} and ${next.grade} overlap.`);
    }
    if (next.minScore - band.maxScore > 1) {
      throw new BadRequestError(`There is a gap between ${band.grade} (${band.maxScore}) and ${next.grade} (${next.minScore}).`);
    }
  }
}

/** Replaces the school's whole scale in one transaction. */
export async function replaceGradeBands(schoolId: string, actorId: string, bands: GradeBand[]) {
  validateBands(bands);

  await withTransaction(async (client) => {
    await client.query("DELETE FROM grading_systems WHERE school_id = $1", [schoolId]);
    for (const band of bands) {
      await client.query(
        `INSERT INTO grading_systems (school_id, name, min_score, max_score, grade, remark, is_pass)
         VALUES ($1, 'Default', $2, $3, $4, $5, $6)`,
        [schoolId, band.minScore, band.maxScore, band.grade.trim(), band.remark ?? null, band.isPass]
      );
    }
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "grading.updated",
    resourceType: "grading_system",
    payload: { bands: bands.length },
  });
  return listGradeBands(schoolId);
}
