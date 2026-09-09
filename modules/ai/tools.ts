/**
 * SchoolOS AI Gateway & Approved Server-Side Tools
 * Enforces role authorization and tenant boundaries before any tool is executed.
 * Under no circumstances is raw database access provided to the LLM.
 */

import { db } from "@/lib/db/mock-db";
import { SecurityContext } from "@/types";
import { assertPermission } from "@/modules/tenancy/tenant-guard";
import { intelligenceEngine } from "@/modules/intelligence/engine";

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: any;
  error?: string;
}

export class AIToolRegistry {
  /**
   * get_school_overview: Retrieves top-level health, attendance, finance, and active counts.
   */
  get_school_overview(ctx: SecurityContext): ToolExecutionResult {
    try {
      assertPermission(ctx, "dashboard:view_management");
      const health = intelligenceEngine.calculateSchoolHealth(ctx);
      const invoices = db.getInvoices(ctx);
      const students = db.getStudents(ctx);
      const classes = db.getClasses(ctx);

      const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
      const totalCollected = invoices.reduce((acc, i) => acc + i.amountPaid, 0);

      return {
        toolName: "get_school_overview",
        success: true,
        data: {
          schoolHealthScore: health.overallScore,
          activeEnrollment: students.length,
          classesCount: classes.length,
          financialSummary: {
            totalBilled,
            totalCollected,
            outstandingDue: totalBilled - totalCollected,
            collectionRate: `${Math.round((totalCollected / totalBilled) * 100)}%`,
          },
          attendanceRate: "88.5%",
          activeAlerts: health.activeSignalsCount,
        },
      };
    } catch (err: any) {
      return { toolName: "get_school_overview", success: false, data: null, error: err.message };
    }
  }

  /**
   * get_attendance_risks: Lists students flagged for low attendance.
   */
  get_attendance_risks(ctx: SecurityContext): ToolExecutionResult {
    try {
      assertPermission(ctx, "attendance:mark");
      const signals = intelligenceEngine.evaluateSignals(ctx);
      const attendanceSignals = signals.filter((s) => s.type === "LOW_ATTENDANCE");

      return {
        toolName: "get_attendance_risks",
        success: true,
        data: attendanceSignals.map((s) => ({
          studentName: s.studentName,
          className: s.className,
          attendanceRate: s.metricValue,
          description: s.description,
          evidence: s.evidence,
        })),
      };
    } catch (err: any) {
      return { toolName: "get_attendance_risks", success: false, data: null, error: err.message };
    }
  }

  /**
   * get_outstanding_balances: Lists overdue unpaid fee accounts.
   */
  get_outstanding_balances(ctx: SecurityContext): ToolExecutionResult {
    try {
      assertPermission(ctx, "finance:view");
      const invoices = db.getInvoices(ctx);
      const overdue = invoices.filter((i) => i.balanceDue > 0);

      return {
        toolName: "get_outstanding_balances",
        success: true,
        data: overdue.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          studentName: i.studentName,
          guardianName: i.guardianName,
          guardianPhone: i.guardianPhone,
          balanceDue: i.balanceDue,
          dueDate: i.dueDate,
          status: i.status,
        })),
      };
    } catch (err: any) {
      return { toolName: "get_outstanding_balances", success: false, data: null, error: err.message };
    }
  }

  /**
   * draft_parent_message: Drafts an assisted polite WhatsApp/SMS message.
   */
  draft_parent_message(
    ctx: SecurityContext,
    params: { studentName: string; purpose: "fee_reminder" | "attendance_concern" }
  ): ToolExecutionResult {
    try {
      assertPermission(ctx, "communication:send");
      const school = db.getSchool(ctx.userSchoolId);
      const schoolName = school?.name || "Emerald Crest Academy";

      let draftedText = "";
      if (params.purpose === "fee_reminder") {
        draftedText = `Good day. This is a cordial reminder from ${schoolName} regarding the outstanding first term fees for ${params.studentName}. Please click the secure Paystack portal link to complete payment. Thank you for your continued partnership.`;
      } else {
        draftedText = `Good day from ${schoolName}. We noticed that ${params.studentName} has missed multiple consecutive school sessions. We value their welfare and academic consistency—kindly reply or call our office at your earliest convenience.`;
      }

      return {
        toolName: "draft_parent_message",
        success: true,
        data: {
          intendedStudent: params.studentName,
          suggestedText: draftedText,
          requiresHumanApproval: true,
        },
      };
    } catch (err: any) {
      return { toolName: "draft_parent_message", success: false, data: null, error: err.message };
    }
  }
}

export const aiTools = new AIToolRegistry();
