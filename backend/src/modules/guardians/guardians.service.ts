import { QueryResult, QueryResultRow } from "pg";

import { pool, query } from "../../db/pool";
import { CreateGuardianInput } from "./guardians.schemas";

interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface GuardianRecord {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string | null;
}

const GUARDIAN_SELECT = "id, school_id, first_name, last_name, relationship, phone, email, address";

export async function listGuardians(schoolId: string): Promise<GuardianRecord[]> {
  const result = await query<GuardianRecord>(
    `SELECT ${GUARDIAN_SELECT} FROM guardians WHERE school_id = $1 ORDER BY last_name ASC`,
    [schoolId]
  );
  return result.rows;
}

export async function createGuardian(schoolId: string, input: CreateGuardianInput): Promise<GuardianRecord> {
  const result = await query<GuardianRecord>(
    `INSERT INTO guardians (school_id, first_name, last_name, relationship, phone, email, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${GUARDIAN_SELECT}`,
    [schoolId, input.firstName, input.lastName, input.relationship, input.phone, input.email, input.address ?? null]
  );
  return result.rows[0];
}

/** Reuses an existing guardian by (school, phone, email) or creates one, for inline enrollment flows. */
export async function findOrCreateGuardian(
  schoolId: string,
  input: CreateGuardianInput,
  client: QueryExecutor = pool
): Promise<GuardianRecord> {
  const existing = await client.query<GuardianRecord>(
    `SELECT ${GUARDIAN_SELECT} FROM guardians WHERE school_id = $1 AND phone = $2 AND email = $3`,
    [schoolId, input.phone, input.email]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0];
  }

  const result = await client.query<GuardianRecord>(
    `INSERT INTO guardians (school_id, first_name, last_name, relationship, phone, email, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${GUARDIAN_SELECT}`,
    [schoolId, input.firstName, input.lastName, input.relationship, input.phone, input.email, input.address ?? null]
  );

  return result.rows[0];
}
