import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";

import { env } from "../config/env";

// Return DATE columns as plain "YYYY-MM-DD" strings instead of pg's default
// (a JS Date at local midnight), which shifts by a day once serialized to
// JSON/UTC for any server timezone ahead of UTC.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

// Return NUMERIC/DECIMAL columns as JS numbers instead of pg's default
// (strings, to avoid float precision loss) — the API and frontend types
// both model amounts/scores as `number`.
types.setTypeParser(types.builtins.NUMERIC, (value: string) => parseFloat(value));

const isLocalDatabase = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
