import fs from "fs";
import path from "path";

import { pool } from "./pool";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../db/migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`FAIL  ${file}`);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Migrations up to date.");
}

runMigrations()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    return pool.end().finally(() => process.exit(1));
  });
