import { query } from "../../db/pool";

export async function listFeeStructures(schoolId: string) {
  const result = await query(
    `SELECT fs.id, fs.school_id, fs.term_id, t.name AS term_name, fs.class_grade_level,
            fs.title, fs.total_amount, fs.due_date
     FROM fee_structures fs
     JOIN terms t ON t.id = fs.term_id
     WHERE fs.school_id = $1
     ORDER BY fs.due_date DESC`,
    [schoolId]
  );

  return result.rows.map((row) => ({ ...row, items: [] as unknown[] }));
}
