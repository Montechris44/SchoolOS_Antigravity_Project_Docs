import { AuthenticatedUser } from "../../middleware/auth";
import { query } from "../../db/pool";
import { ForbiddenError } from "../../shared/http/errors";
import { requirePermission } from "../../shared/security/tenant-guard";
import { calculateSchoolHealth, evaluateSignals } from "../intelligence/intelligence.service";

export interface ChatResult {
  answer: string;
  toolExecuted: string | null;
  toolSuccess: boolean | null;
}

async function getSchoolOverview(actor: AuthenticatedUser): Promise<string> {
  requirePermission(actor, "dashboard:view_management");

  const [health, studentsResult, classesResult, invoiceResult] = await Promise.all([
    calculateSchoolHealth(actor.schoolId),
    query<{ count: string }>("SELECT COUNT(*) FROM students WHERE school_id = $1", [actor.schoolId]),
    query<{ count: string }>("SELECT COUNT(*) FROM classes WHERE school_id = $1", [actor.schoolId]),
    query<{ total_billed: number | null; total_collected: number | null }>(
      "SELECT SUM(total_amount) AS total_billed, SUM(amount_paid) AS total_collected FROM invoices WHERE school_id = $1",
      [actor.schoolId]
    ),
  ]);

  const totalBilled = invoiceResult.rows[0]?.total_billed ?? 0;
  const totalCollected = invoiceResult.rows[0]?.total_collected ?? 0;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  return (
    `Based on current operational records, your School Health Score is **${health.overall_score}/100**.\n\n` +
    `• **Financial Status**: Total Billed is ₦${totalBilled.toLocaleString()} with ₦${totalCollected.toLocaleString()} verified (${collectionRate}% collection rate). Unsettled balance is ₦${(totalBilled - totalCollected).toLocaleString()}.\n` +
    `• **Enrolment**: ${studentsResult.rows[0].count} enrolled scholars across ${classesResult.rows[0].count} active classes.\n` +
    `• **Attendance Health**: ${health.attendance_health}% over the last 30 days.\n` +
    `• **Active Risk Signals**: ${health.active_signals_count.critical} Critical, ${health.active_signals_count.high} High priority signals requiring attention.`
  );
}

async function getAttendanceRisks(actor: AuthenticatedUser): Promise<string> {
  requirePermission(actor, "attendance:mark");

  const signals = (await evaluateSignals(actor.schoolId)).filter((s) => s.type === "LOW_ATTENDANCE");

  if (signals.length === 0) {
    return "All classes are currently meeting or exceeding the 75% attendance threshold with no active risks.";
  }

  const lines = signals.map(
    (s) => `• **${s.student_name}** (${s.class_name}): Attendance rate is **${s.metric_value}**. ${s.description}`
  );

  return (
    `Identified **${signals.length} attendance risk(s)**:\n\n${lines.join("\n")}\n\n` +
    `*Recommendation: Follow up via Action Center to verify student welfare.*`
  );
}

async function getOutstandingBalances(actor: AuthenticatedUser): Promise<string> {
  requirePermission(actor, "finance:view");

  const result = await query<{
    invoice_number: string;
    student_name: string;
    guardian_name: string | null;
    guardian_phone: string | null;
    balance_due: number;
    due_date: string;
    status: string;
  }>(
    `SELECT i.invoice_number, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
            CASE WHEN g.id IS NOT NULL THEN CONCAT(g.first_name, ' ', g.last_name) END AS guardian_name,
            g.phone AS guardian_phone, i.balance_due, i.due_date, i.status
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     LEFT JOIN guardians g ON g.id = i.guardian_id
     WHERE i.school_id = $1 AND i.balance_due > 0
     ORDER BY i.due_date ASC`,
    [actor.schoolId]
  );

  if (result.rowCount === 0) {
    return "No outstanding fee balances — every issued invoice is fully settled.";
  }

  const lines = result.rows.map(
    (b) =>
      `• **${b.student_name}** (Invoice ${b.invoice_number}): Outstanding balance of **₦${Number(b.balance_due).toLocaleString()}** (Due: ${b.due_date}). Parent: ${b.guardian_name ?? "Not on file"} (${b.guardian_phone ?? "n/a"}). Status: **${b.status}**`
  );

  return (
    `Found **${result.rowCount} outstanding account(s)**:\n\n${lines.join("\n")}\n\n` +
    `*Recommendation: Dispatch a Paystack payment link via Communication.*`
  );
}

async function draftParentMessage(actor: AuthenticatedUser, prompt: string): Promise<string> {
  requirePermission(actor, "communication:send");

  const [schoolResult, studentsResult] = await Promise.all([
    query<{ name: string }>("SELECT name FROM schools WHERE id = $1", [actor.schoolId]),
    query<{ first_name: string; last_name: string }>(
      "SELECT first_name, last_name FROM students WHERE school_id = $1",
      [actor.schoolId]
    ),
  ]);

  const schoolName = schoolResult.rows[0]?.name ?? "your school";
  const lowerPrompt = prompt.toLowerCase();
  const matchedStudent = studentsResult.rows.find((s) =>
    lowerPrompt.includes(`${s.first_name} ${s.last_name}`.toLowerCase())
  );
  const studentName = matchedStudent ? `${matchedStudent.first_name} ${matchedStudent.last_name}` : "the student";

  const isAttendanceConcern = lowerPrompt.includes("attendance");
  const draftedText = isAttendanceConcern
    ? `Good day from ${schoolName}. We noticed that ${studentName} has missed multiple consecutive school sessions. We value their welfare and academic consistency—kindly reply or call our office at your earliest convenience.`
    : `Good day. This is a cordial reminder from ${schoolName} regarding the outstanding fees for ${studentName}. Please use your secure Paystack payment link to complete payment. Thank you for your continued partnership.`;

  return `Here is a drafted message for human review before dispatch:\n\n> "${draftedText}"\n\n*(Note: Consequential broadcasts require human confirmation before sending)*`;
}

export async function chat(actor: AuthenticatedUser, prompt: string): Promise<ChatResult> {
  const lower = prompt.toLowerCase();
  let toolExecuted: string | null = null;

  try {
    if (lower.includes("how is my school") || lower.includes("overview") || lower.includes("health")) {
      toolExecuted = "get_school_overview";
      return { answer: await getSchoolOverview(actor), toolExecuted, toolSuccess: true };
    }

    if (lower.includes("attendance") && !lower.includes("draft") && !lower.includes("remind")) {
      toolExecuted = "get_attendance_risks";
      return { answer: await getAttendanceRisks(actor), toolExecuted, toolSuccess: true };
    }

    if (
      (lower.includes("fee") || lower.includes("balance") || lower.includes("owe") || lower.includes("unpaid")) &&
      !lower.includes("draft") &&
      !lower.includes("remind")
    ) {
      toolExecuted = "get_outstanding_balances";
      return { answer: await getOutstandingBalances(actor), toolExecuted, toolSuccess: true };
    }

    if (lower.includes("draft") || lower.includes("remind") || lower.includes("message")) {
      toolExecuted = "draft_parent_message";
      return { answer: await draftParentMessage(actor, prompt), toolExecuted, toolSuccess: true };
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { answer: `Access Denied: ${error.message}`, toolExecuted, toolSuccess: false };
    }
    throw error;
  }

  return {
    answer:
      "I can answer data-backed questions on **School Health Overview**, **Attendance Risks**, **Outstanding Invoices**, or **Draft Parent Reminders**. Try asking: \"How is my school doing?\" or \"Who owes school fees?\"",
    toolExecuted: null,
    toolSuccess: null,
  };
}
