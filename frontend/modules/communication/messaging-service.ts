/**
 * SchoolOS Communication & Messaging Engine
 * Pre-approved message templates for parent/staff broadcasts.
 */

export interface CommunicationTemplate {
  id: string;
  name: string;
  channel: "whatsapp" | "sms" | "all";
  subject: string;
  body: string;
  variables: string[];
}

export const SYSTEM_TEMPLATES: CommunicationTemplate[] = [
  {
    id: "tmpl_fee_reminder",
    name: "Outstanding Fee Payment Reminder",
    channel: "all",
    subject: "Reminder: Outstanding School Fees",
    body: "Dear {{guardian_name}}, this is a gentle reminder from {{school_name}} regarding the outstanding balance of {{amount_due}} for {{student_name}}. Please settle via your secure Paystack payment link.",
    variables: ["guardian_name", "school_name", "amount_due", "student_name"],
  },
  {
    id: "tmpl_attendance_alert",
    name: "Student Absence Alert",
    channel: "whatsapp",
    subject: "Attendance Alert",
    body: "Dear {{guardian_name}}, {{student_name}} was marked absent today {{date}} at {{school_name}}. If this absence is unexpected, please contact the school office immediately.",
    variables: ["guardian_name", "student_name", "date", "school_name"],
  },
  {
    id: "tmpl_report_card",
    name: "Terminal Result Publication",
    channel: "all",
    subject: "Academic Report Card Published",
    body: "Dear {{guardian_name}}, the official report card for {{student_name}} ({{term_name}}) is now available on SchoolOS. Overall Average: {{overall_average}}%. Log in to view full grades.",
    variables: ["guardian_name", "student_name", "term_name", "overall_average"],
  },
];
