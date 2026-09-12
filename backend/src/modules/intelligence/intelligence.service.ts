import { query } from "../../db/pool";

const ATTENDANCE_LOOKBACK_DAYS = 30;
const LOW_ATTENDANCE_THRESHOLD = 0.75;
const MIN_MARKED_DAYS = 5;

export interface Signal {
  id: string;
  school_id: string;
  type: "LOW_ATTENDANCE" | "OVERDUE_FEES";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  metric_value: string;
  threshold: string;
  student_id: string | null;
  student_name: string | null;
  class_id: string | null;
  class_name: string | null;
  evidence: Record<string, unknown>;
  detected_at: string;
  action_created: boolean;
}

async function detectLowAttendanceSignals(schoolId: string): Promise<Signal[]> {
  const result = await query<{
    student_id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    class_name: string;
    total_days: string;
    present_days: string;
  }>(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.current_class_id AS class_id, c.name AS class_name,
            COUNT(*) AS total_days,
            COUNT(*) FILTER (WHERE a.status = 'PRESENT') AS present_days
     FROM attendance_records a
     JOIN students s ON s.id = a.student_id
     JOIN classes c ON c.id = s.current_class_id
     WHERE a.school_id = $1 AND a.date >= CURRENT_DATE - INTERVAL '${ATTENDANCE_LOOKBACK_DAYS} days'
     GROUP BY s.id, s.first_name, s.last_name, s.current_class_id, c.name
     HAVING COUNT(*) >= ${MIN_MARKED_DAYS}`,
    [schoolId]
  );

  return result.rows
    .map((row) => {
      const totalDays = parseInt(row.total_days, 10);
      const presentDays = parseInt(row.present_days, 10);
      const rate = presentDays / totalDays;
      return { row, rate, totalDays, presentDays };
    })
    .filter(({ rate }) => rate < LOW_ATTENDANCE_THRESHOLD)
    .map(({ row, rate, totalDays, presentDays }) => {
      const ratePercent = Math.round(rate * 100);
      const studentName = `${row.first_name} ${row.last_name}`;
      return {
        id: `low_attendance:${row.student_id}`,
        school_id: schoolId,
        type: "LOW_ATTENDANCE" as const,
        title: "Low Attendance Risk",
        description: `${studentName} has only ${ratePercent}% attendance over the last ${ATTENDANCE_LOOKBACK_DAYS} days.`,
        severity: ratePercent < 50 ? ("critical" as const) : ("high" as const),
        metric_value: `${ratePercent}% Attendance Rate`,
        threshold: `Required > ${Math.round(LOW_ATTENDANCE_THRESHOLD * 100)}%`,
        student_id: row.student_id,
        student_name: studentName,
        class_id: row.class_id,
        class_name: row.class_name,
        evidence: { daysAttended: presentDays, totalDays, unexcusedAbsences: totalDays - presentDays },
        detected_at: new Date().toISOString(),
        action_created: false,
      };
    });
}

async function detectOverdueFeeSignals(schoolId: string): Promise<Signal[]> {
  const result = await query<{
    id: string;
    invoice_number: string;
    total_amount: number;
    balance_due: number;
    due_date: string;
    student_id: string;
    student_name: string;
    guardian_name: string | null;
    guardian_phone: string | null;
  }>(
    `SELECT i.id, i.invoice_number, i.total_amount, i.balance_due, i.due_date, i.student_id,
            CONCAT(s.first_name, ' ', s.last_name) AS student_name,
            CASE WHEN g.id IS NOT NULL THEN CONCAT(g.first_name, ' ', g.last_name) END AS guardian_name,
            g.phone AS guardian_phone
     FROM invoices i
     JOIN students s ON s.id = i.student_id
     LEFT JOIN guardians g ON g.id = i.guardian_id
     WHERE i.school_id = $1 AND i.balance_due > 0 AND i.due_date < CURRENT_DATE`,
    [schoolId]
  );

  return result.rows.map((row) => ({
    id: `overdue_fee:${row.id}`,
    school_id: schoolId,
    type: "OVERDUE_FEES" as const,
    title: "Overdue Term Billing Account",
    description: `${row.student_name} has an outstanding unpaid fee of ₦${Number(row.balance_due).toLocaleString()} past due date.`,
    severity: "critical" as const,
    metric_value: `₦${Number(row.balance_due).toLocaleString()} Overdue`,
    threshold: `Due on ${row.due_date}`,
    student_id: row.student_id,
    student_name: row.student_name,
    class_id: null,
    class_name: null,
    evidence: {
      invoiceId: row.id,
      invoiceNumber: row.invoice_number,
      totalAmount: row.total_amount,
      balanceDue: row.balance_due,
      guardianName: row.guardian_name,
      guardianPhone: row.guardian_phone,
    },
    detected_at: new Date().toISOString(),
    action_created: false,
  }));
}

export async function evaluateSignals(schoolId: string): Promise<Signal[]> {
  const [attendanceSignals, feeSignals] = await Promise.all([
    detectLowAttendanceSignals(schoolId),
    detectOverdueFeeSignals(schoolId),
  ]);
  return [...feeSignals, ...attendanceSignals];
}

export interface SchoolHealthScore {
  overall_score: number;
  financial_health: number;
  attendance_health: number;
  academic_health: number;
  submission_compliance: number;
  active_signals_count: { critical: number; high: number; medium: number; low: number };
}

export async function calculateSchoolHealth(schoolId: string): Promise<SchoolHealthScore> {
  const [financeResult, attendanceResult, academicResult, submissionResult, signals] = await Promise.all([
    query<{ total_billed: number | null; total_collected: number | null }>(
      "SELECT SUM(total_amount) AS total_billed, SUM(amount_paid) AS total_collected FROM invoices WHERE school_id = $1",
      [schoolId]
    ),
    query<{ present: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'PRESENT') AS present, COUNT(*) AS total
       FROM attendance_records WHERE school_id = $1 AND date >= CURRENT_DATE - INTERVAL '${ATTENDANCE_LOOKBACK_DAYS} days'`,
      [schoolId]
    ),
    query<{ avg_pct: number | null }>(
      `SELECT AVG(sc.score_obtained / a.max_score * 100) AS avg_pct
       FROM scores sc JOIN assessments a ON a.id = sc.assessment_id
       WHERE sc.school_id = $1`,
      [schoolId]
    ),
    query<{ with_scores: string; total: string }>(
      `SELECT
         COUNT(DISTINCT a.id) FILTER (WHERE sc.id IS NOT NULL) AS with_scores,
         COUNT(DISTINCT a.id) AS total
       FROM assessments a
       LEFT JOIN scores sc ON sc.assessment_id = a.id
       WHERE a.school_id = $1`,
      [schoolId]
    ),
    evaluateSignals(schoolId),
  ]);

  const totalBilled = financeResult.rows[0]?.total_billed ?? 0;
  const totalCollected = financeResult.rows[0]?.total_collected ?? 0;
  const financialHealth = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

  const presentDays = parseInt(attendanceResult.rows[0]?.present ?? "0", 10);
  const totalDays = parseInt(attendanceResult.rows[0]?.total ?? "0", 10);
  const attendanceHealth = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  const academicHealth = academicResult.rows[0]?.avg_pct != null ? Math.round(academicResult.rows[0].avg_pct) : 100;

  const withScores = parseInt(submissionResult.rows[0]?.with_scores ?? "0", 10);
  const totalAssessments = parseInt(submissionResult.rows[0]?.total ?? "0", 10);
  const submissionCompliance = totalAssessments > 0 ? Math.round((withScores / totalAssessments) * 100) : 100;

  const overallScore = Math.round(
    financialHealth * 0.3 + academicHealth * 0.3 + attendanceHealth * 0.25 + submissionCompliance * 0.15
  );

  return {
    overall_score: overallScore,
    financial_health: financialHealth,
    attendance_health: attendanceHealth,
    academic_health: academicHealth,
    submission_compliance: submissionCompliance,
    active_signals_count: {
      critical: signals.filter((s) => s.severity === "critical").length,
      high: signals.filter((s) => s.severity === "high").length,
      medium: signals.filter((s) => s.severity === "medium").length,
      low: signals.filter((s) => s.severity === "low").length,
    },
  };
}
