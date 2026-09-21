import { UserRole } from "../../config/rbac";

export interface FinanceActor {
  role: UserRole;
  userId: string;
}

/**
 * Which invoices a caller may see. Owners, administrators and bursars see the whole school; a parent only the
 * invoices of their own children; a student only their own. Every other role sees none.
 * (Parents previously held the same finance:view permission as staff and could list every family's invoices.)
 */
export function financeVisibility(actor: FinanceActor, params: unknown[], studentIdExpr: string): string {
  if (actor.role === "owner" || actor.role === "admin" || actor.role === "bursar") return "TRUE";

  params.push(actor.userId);
  const user = `$${params.length}`;

  if (actor.role === "parent") {
    return `${studentIdExpr} IN (
      SELECT s.id FROM students s JOIN guardians g ON g.id = s.guardian_id WHERE g.user_id = ${user}
    )`;
  }
  if (actor.role === "student") {
    return `${studentIdExpr} IN (SELECT s.id FROM students s WHERE s.user_id = ${user})`;
  }
  return "FALSE";
}
