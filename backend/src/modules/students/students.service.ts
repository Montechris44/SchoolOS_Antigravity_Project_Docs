import { withTransaction, query } from "../../db/pool";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { findOrCreateGuardian } from "../guardians/guardians.service";
import { CreateStudentInput } from "./students.schemas";

const STUDENT_SELECT = `
  SELECT
    s.id, s.school_id, s.admission_number, s.first_name, s.last_name, s.middle_name,
    s.gender, s.date_of_birth, s.current_class_id, s.guardian_id,
    s.enrollment_status, s.enrolled_date,
    c.name AS current_class_name,
    g.first_name AS guardian_first_name, g.last_name AS guardian_last_name,
    g.phone AS guardian_phone, g.email AS guardian_email
  FROM students s
  JOIN classes c ON c.id = s.current_class_id
  LEFT JOIN guardians g ON g.id = s.guardian_id
`;

interface StudentRow {
  id: string;
  school_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string;
  date_of_birth: string;
  current_class_id: string;
  guardian_id: string | null;
  enrollment_status: string;
  enrolled_date: string;
  current_class_name: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
}

function toStudentRecord(row: StudentRow) {
  return {
    id: row.id,
    school_id: row.school_id,
    admission_number: row.admission_number,
    first_name: row.first_name,
    last_name: row.last_name,
    middle_name: row.middle_name,
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    current_class_id: row.current_class_id,
    current_class_name: row.current_class_name,
    guardian_id: row.guardian_id,
    guardian_name: row.guardian_id ? `${row.guardian_first_name} ${row.guardian_last_name}` : null,
    guardian_phone: row.guardian_phone,
    guardian_email: row.guardian_email,
    enrollment_status: row.enrollment_status,
    enrolled_date: row.enrolled_date,
  };
}

export async function listStudents(schoolId: string, classId?: string) {
  const conditions = ["s.school_id = $1"];
  const params: unknown[] = [schoolId];

  if (classId) {
    params.push(classId);
    conditions.push(`s.current_class_id = $${params.length}`);
  }

  const result = await query<StudentRow>(
    `${STUDENT_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY s.last_name ASC, s.first_name ASC`,
    params
  );

  return result.rows.map(toStudentRecord);
}

export async function getStudentById(schoolId: string, studentId: string) {
  const result = await query<StudentRow>(`${STUDENT_SELECT} WHERE s.school_id = $1 AND s.id = $2`, [
    schoolId,
    studentId,
  ]);

  if (result.rowCount === 0) {
    throw new NotFoundError("Student not found.");
  }

  return toStudentRecord(result.rows[0]);
}

export async function createStudent(schoolId: string, input: CreateStudentInput) {
  const classResult = await query<{ id: string }>("SELECT id FROM classes WHERE school_id = $1 AND id = $2", [
    schoolId,
    input.classId,
  ]);

  if (classResult.rowCount === 0) {
    throw new NotFoundError("Selected class was not found in this school.");
  }

  const existingAdmission = await query<{ id: string }>(
    "SELECT id FROM students WHERE school_id = $1 AND admission_number = $2",
    [schoolId, input.admissionNumber]
  );

  if (existingAdmission.rowCount && existingAdmission.rowCount > 0) {
    throw new ConflictError(`Admission number '${input.admissionNumber}' is already registered in this school.`);
  }

  const studentId = await withTransaction(async (client) => {
    let guardianId: string | null = null;

    if (input.guardian) {
      const guardian = await findOrCreateGuardian(schoolId, input.guardian, client);
      guardianId = guardian.id;
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO students (
         school_id, admission_number, first_name, last_name, middle_name,
         gender, date_of_birth, current_class_id, guardian_id, enrollment_status, enrolled_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE))
       RETURNING id`,
      [
        schoolId,
        input.admissionNumber,
        input.firstName,
        input.lastName,
        input.middleName ?? null,
        input.gender,
        input.dateOfBirth,
        input.classId,
        guardianId,
        input.enrollmentStatus,
        input.enrolledDate ?? null,
      ]
    );

    return result.rows[0].id;
  });

  return getStudentById(schoolId, studentId);
}
