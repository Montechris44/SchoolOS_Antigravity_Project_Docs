import bcrypt from "bcryptjs";

import { query, withTransaction } from "../../db/pool";
import { ConflictError } from "../../shared/http/errors";
import { CreateStaffInput } from "./staff.schemas";

const BCRYPT_ROUNDS = 12;

const STAFF_SELECT = `
  SELECT
    st.id, st.school_id, st.user_id, st.employee_id, st.first_name, st.last_name,
    st.role, st.title, st.phone, st.email, st.is_active, st.created_at AS hire_date,
    COALESCE(array_agg(DISTINCT ta.class_id) FILTER (WHERE ta.class_id IS NOT NULL), '{}') AS assigned_class_ids,
    COALESCE(array_agg(DISTINCT ta.subject_id) FILTER (WHERE ta.subject_id IS NOT NULL), '{}') AS assigned_subject_ids
  FROM staff st
  LEFT JOIN teacher_assignments ta ON ta.staff_id = st.id
`;

const STAFF_GROUP_BY = "GROUP BY st.id";

export async function listStaff(schoolId: string) {
  const result = await query(
    `${STAFF_SELECT} WHERE st.school_id = $1 ${STAFF_GROUP_BY} ORDER BY st.last_name ASC, st.first_name ASC`,
    [schoolId]
  );
  return result.rows;
}

export async function createStaff(schoolId: string, input: CreateStaffInput) {
  const existingProfile = await query<{ id: string }>("SELECT id FROM profiles WHERE email = $1", [
    input.email.toLowerCase(),
  ]);

  if (existingProfile.rowCount && existingProfile.rowCount > 0) {
    throw new ConflictError("An account with this email already exists.");
  }

  const existingEmployeeId = await query<{ id: string }>(
    "SELECT id FROM staff WHERE school_id = $1 AND employee_id = $2",
    [schoolId, input.employeeId]
  );

  if (existingEmployeeId.rowCount && existingEmployeeId.rowCount > 0) {
    throw new ConflictError(`Employee ID '${input.employeeId}' is already in use.`);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const staffId = await withTransaction(async (client) => {
    const profileResult = await client.query<{ id: string }>(
      `INSERT INTO profiles (email, full_name, phone, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.email.toLowerCase(), `${input.firstName} ${input.lastName}`, input.phone, passwordHash]
    );
    const userId = profileResult.rows[0].id;

    await client.query(
      `INSERT INTO memberships (school_id, user_id, role, is_active) VALUES ($1, $2, $3, TRUE)`,
      [schoolId, userId, input.role]
    );

    const staffResult = await client.query<{ id: string }>(
      `INSERT INTO staff (school_id, user_id, employee_id, first_name, last_name, role, title, phone, email, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       RETURNING id`,
      [
        schoolId,
        userId,
        input.employeeId,
        input.firstName,
        input.lastName,
        input.role,
        input.title,
        input.phone,
        input.email.toLowerCase(),
      ]
    );

    return staffResult.rows[0].id;
  });

  const result = await query(`${STAFF_SELECT} WHERE st.id = $1 ${STAFF_GROUP_BY}`, [staffId]);
  return result.rows[0];
}
