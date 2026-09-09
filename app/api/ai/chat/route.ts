import { NextRequest, NextResponse } from "next/server";
import { aiTools, ToolExecutionResult } from "@/modules/ai/tools";
import { UserRole } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { prompt, schoolId, userId, role } = await req.json();

    if (!prompt || !schoolId) {
      return NextResponse.json({ error: "Missing required prompt or schoolId" }, { status: 400 });
    }

    const secCtx = {
      userId: userId || "usr_owner_01",
      userSchoolId: schoolId,
      role: (role || "owner") as UserRole,
    };

    const lower = prompt.toLowerCase();
    let toolResult: ToolExecutionResult | null = null;
    let groundedAnswer = "";

    // Intent routing to approved server-side tools
    if (lower.includes("how is my school") || lower.includes("overview") || lower.includes("health")) {
      toolResult = aiTools.get_school_overview(secCtx);
      if (toolResult.success) {
        const d = toolResult.data;
        groundedAnswer = `Based on current operational records, your School Health Score is **${d.schoolHealthScore}/100**.\n\n• **Financial Status**: Total Billed is ₦${d.financialSummary.totalBilled.toLocaleString()} with ₦${d.financialSummary.totalCollected.toLocaleString()} verified (${d.financialSummary.collectionRate} collection rate). Unsettled balance is ₦${d.financialSummary.outstandingDue.toLocaleString()}.\n• **Enrolment**: ${d.activeEnrollment} enrolled scholars across ${d.classesCount} active classes.\n• **Daily Attendance**: Average rate is ${d.attendanceRate}.\n• **Active Risk Signals**: ${d.activeAlerts.critical} Critical, ${d.activeAlerts.high} High priority signals requiring attention.`;
      } else {
        groundedAnswer = `Access Denied: ${toolResult.error}`;
      }
    } else if (lower.includes("attendance") || lower.includes("absent") || lower.includes("chioma")) {
      toolResult = aiTools.get_attendance_risks(secCtx);
      if (toolResult.success) {
        const risks = toolResult.data;
        if (risks.length === 0) {
          groundedAnswer = "All classes are currently meeting or exceeding the 75% attendance threshold with no active risks.";
        } else {
          groundedAnswer = `Identified **${risks.length} attendance risk(s)**:\n\n` +
            risks.map((r: any) => `• **${r.studentName}** (${r.className}): Attendance rate is **${r.attendanceRate}** (${r.evidence.daysAttended}/${r.evidence.totalDays} sessions attended). ${r.description}`).join("\n") +
            `\n\n*Recommendation: Follow up via Action Center to verify student welfare.*`;
        }
      } else {
        groundedAnswer = `Access Denied: ${toolResult.error}`;
      }
    } else if (lower.includes("fee") || lower.includes("balance") || lower.includes("owe") || lower.includes("unpaid")) {
      toolResult = aiTools.get_outstanding_balances(secCtx);
      if (toolResult.success) {
        const balances = toolResult.data;
        groundedAnswer = `Found **${balances.length} outstanding accounts**:\n\n` +
          balances.map((b: any) => `• **${b.studentName}** (Invoice ${b.invoiceNumber}): Outstanding balance of **₦${b.balanceDue.toLocaleString()}** (Due: ${b.dueDate}). Parent: ${b.guardianName} (${b.guardianPhone}). Status: **${b.status}**`).join("\n") +
          `\n\n*Recommendation: Dispatch automated Paystack WhatsApp payment links.*`;
      } else {
        groundedAnswer = `Access Denied: ${toolResult.error}`;
      }
    } else if (lower.includes("draft") || lower.includes("remind") || lower.includes("message")) {
      const studentName = lower.includes("chioma") ? "Chioma Eze" : "Femi Williams";
      const purpose = lower.includes("attendance") ? "attendance_concern" : "fee_reminder";
      toolResult = aiTools.draft_parent_message(secCtx, { studentName, purpose });
      if (toolResult.success) {
        groundedAnswer = `Here is a drafted message for human review before dispatch:\n\n> "${toolResult.data.suggestedText}"\n\n*(Note: Consequential broadcasts require human confirmation before sending)*`;
      } else {
        groundedAnswer = `Access Denied: ${toolResult.error}`;
      }
    } else {
      groundedAnswer = `I can answer data-backed questions on **School Health Overview**, **Attendance Risks**, **Outstanding Invoices**, or **Draft Parent Reminders**. Try asking: *"How is my school doing?"* or *"Who owes school fees?"*`;
    }

    return NextResponse.json({
      answer: groundedAnswer,
      toolExecuted: toolResult ? toolResult.toolName : null,
      toolSuccess: toolResult ? toolResult.success : null,
      groundingData: toolResult ? toolResult.data : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
