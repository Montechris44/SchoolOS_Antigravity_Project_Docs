import { query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";
import { SchoolRecord } from "../auth/auth.service";
import { UpdateSchoolInput } from "./schools.schemas";

const SCHOOL_COLUMNS =
  "id, name, slug, logo_url, address, city, state, country, phone, email, currency, created_at";

const FIELD_TO_COLUMN: Record<keyof UpdateSchoolInput, string> = {
  name: "name",
  logoUrl: "logo_url",
  address: "address",
  city: "city",
  state: "state",
  country: "country",
  phone: "phone",
  email: "email",
  currency: "currency",
};

export async function getSchoolById(schoolId: string): Promise<SchoolRecord> {
  const result = await query<SchoolRecord>(`SELECT ${SCHOOL_COLUMNS} FROM schools WHERE id = $1`, [schoolId]);

  if (result.rowCount === 0) {
    throw new NotFoundError("School not found.");
  }

  return result.rows[0];
}

export async function updateSchool(schoolId: string, input: UpdateSchoolInput): Promise<SchoolRecord> {
  const entries = Object.entries(input) as Array<[keyof UpdateSchoolInput, string | undefined]>;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  entries.forEach(([field, value]) => {
    if (value === undefined) return;
    if (field === "email") {
      values.push(value.toLowerCase());
    } else if (field === "currency") {
      values.push(value.toUpperCase());
    } else {
      values.push(value);
    }
    setClauses.push(`${FIELD_TO_COLUMN[field]} = $${values.length}`);
  });

  if (setClauses.length === 0) {
    return getSchoolById(schoolId);
  }

  values.push(schoolId);
  setClauses.push("updated_at = NOW()");

  const result = await query<SchoolRecord>(
    `UPDATE schools SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING ${SCHOOL_COLUMNS}`,
    values
  );

  if (result.rowCount === 0) {
    throw new NotFoundError("School not found.");
  }

  return result.rows[0];
}
