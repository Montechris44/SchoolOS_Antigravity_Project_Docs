/**
 * Provisions a super admin. There is deliberately no public API endpoint to
 * create one — matching the reference project, the only way in is a
 * server-side seed run by whoever operates the deployment.
 *
 * Usage:
 *   npm run seed:super-admin -- --email owner@schoolos.app --password "..." --name "SchoolOS Support"
 */
import bcrypt from "bcryptjs";

import { pool, query } from "./pool";

const BCRYPT_ROUNDS = 12;

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = readArg("--email");
  const password = readArg("--password");
  const fullName = readArg("--name") ?? "Platform Admin";

  if (!email || !password) {
    console.error("Usage: npm run seed:super-admin -- --email <email> --password <password> [--name <full name>]");
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const existing = await query<{ id: string }>("SELECT id FROM super_admins WHERE email = $1", [
    email.toLowerCase(),
  ]);

  if (existing.rowCount && existing.rowCount > 0) {
    console.error(`A super admin with email ${email} already exists.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await query<{ id: string }>(
    `INSERT INTO super_admins (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
    [email.toLowerCase(), passwordHash, fullName]
  );

  console.log(`Super admin created: ${email} (id: ${result.rows[0].id})`);
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error);
    return pool.end().finally(() => process.exit(1));
  });
