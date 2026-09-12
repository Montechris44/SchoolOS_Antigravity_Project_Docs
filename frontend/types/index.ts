/**
 * SchoolOS Core Domain Types
 * Single source of truth for the multi-tenant school operating system
 */

export type UserRole = "owner" | "admin" | "bursar" | "teacher" | "parent" | "student";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface SecurityContext {
  userId: string;
  userSchoolId: string;
  role: UserRole;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  address: string;
  city: string;
  state: string; // e.g. Lagos, Abuja FCT, Rivers
  country: string; // Nigeria
  phone: string;
  email: string;
  currency: string; // NGN
  gradingScaleId?: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  schoolId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
  invitedAt?: string;
  joinedAt: string;
}

export interface AcademicSession {
  id: string;
  schoolId: string;
  name: string; // e.g., "2026/2027"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export type TermName = "First Term" | "Second Term" | "Third Term";

export interface Term {
  id: string;
  schoolId: string;
  sessionId: string;
  name: TermName;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string; // e.g., "JSS 1 Gold", "SS 2 Science A", "Primary 4 Blue"
  gradeLevel: string; // "JSS 1", "SS 2", "Primary 4"
  capacity: number;
  classTeacherId?: string;
  classTeacherName?: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string; // e.g. "Mathematics", "English Language", "Basic Science"
  code: string; // e.g. "MTH", "ENG", "BSC"
}

export interface Student {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: "male" | "female";
  dateOfBirth: string;
  currentClassId: string;
  currentClassName: string;
  guardianId?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  enrollmentStatus: "active" | "graduated" | "transferred" | "suspended";
  enrolledDate: string;
}

export interface Guardian {
  id: string;
  schoolId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  relationship: "father" | "mother" | "guardian" | "other";
  phone: string;
  email: string;
  address?: string;
  occupation?: string;
}

export interface Staff {
  id: string;
  schoolId: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  title: string; // "Senior Math Teacher", "Bursar", "Vice Principal"
  assignedClassIds: string[];
  assignedSubjectIds: string[];
  isActive: boolean;
  hireDate: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  markedByUserId: string;
  notes?: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  termId: string;
  name: string; // e.g. "1st Continuous Assessment", "Midterm Test", "Final Exam"
  type: "CA1" | "CA2" | "EXAM" | "PROJECT";
  maxScore: number; // e.g. 20 for CA, 60 for Exam
  weightPercentage: number;
}

export interface Score {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  scoreObtained: number;
  enteredByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradeBoundary {
  grade: string; // "A", "B", "C", "D", "E", "F"
  minScore: number; // e.g. 70
  maxScore: number; // e.g. 100
  remark: string; // "Distinction", "Very Good", "Credit", "Pass", "Fail"
  gpaPoint?: number;
}

export interface GradeScale {
  id: string;
  schoolId: string;
  name: string; // e.g. "Standard Nigerian WAEC Scale"
  boundaries: GradeBoundary[];
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  caScore: number; // e.g. 30/40
  examScore: number; // e.g. 55/60
  totalScore: number; // e.g. 85/100
  grade: string; // "A"
  remark: string; // "Distinction"
  classAverage?: number;
  positionInSubject?: number;
}

export interface ReportCard {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  termId: string;
  termName: TermName;
  results: SubjectResult[];
  overallAverage: number;
  totalScore: number;
  totalPossibleScore: number;
  positionInClass?: number;
  totalStudentsInClass: number;
  attendanceDaysPresent: number;
  attendanceDaysTotal: number;
  principalRemarks?: string;
  teacherRemarks?: string;
  isPublished: boolean;
  publishedAt?: string;
}

export interface FeeItem {
  id: string;
  name: string; // e.g. "Tuition Fee", "ICT / Computer Fee", "Uniform & Books", "PTA Levy"
  amount: number; // Naira amount
  category: "compulsory" | "optional" | "boarding";
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  termId: string;
  termName: string;
  classGradeLevel: string; // e.g. "JSS 1", "All Classes"
  title: string;
  items: FeeItem[];
  totalAmount: number;
  dueDate: string;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  id: string;
  schoolId: string;
  invoiceNumber: string; // e.g., "INV-2026-0012"
  studentId: string;
  studentName: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  termId: string;
  termName: string;
  items: Array<{
    id: string;
    description: string;
    amount: number;
  }>;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  dueDate: string;
  issuedAt: string;
}

export type PaymentStatus = "INITIATED" | "PENDING" | "VERIFIED_SUCCESS" | "FAILED" | "CANCELLED";
export type PaymentMethod = "paystack" | "bank_transfer" | "pos" | "cash";

export interface Payment {
  id: string;
  schoolId: string;
  invoiceId: string;
  receiptNumber: string;
  amount: number; // in Naira
  provider: "paystack" | "manual";
  providerReference: string; // Unique paystack ref or bank teller ref
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  payerName: string;
  payerEmail?: string;
  payerPhone?: string;
  verifiedAt?: string;
  idempotencyKey: string;
}

export interface Receipt {
  id: string;
  schoolId: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  studentName: string;
  admissionNumber: string;
  amountPaid: number;
  remainingBalance: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  receivedBy: string;
}

export type SignalType = 
  | "LOW_ATTENDANCE" 
  | "OVERDUE_FEES" 
  | "ACADEMIC_DECLINE" 
  | "MISSING_TEACHER_SUBMISSIONS" 
  | "CLASS_FAILURE_SPIKE";

export type SignalSeverity = "low" | "medium" | "high" | "critical";

export interface IntelligenceSignal {
  id: string;
  schoolId: string;
  type: SignalType;
  title: string;
  description: string;
  severity: SignalSeverity;
  metricValue: string; // e.g. "62% Attendance", "₦185,000 Overdue"
  threshold: string; // e.g. "Threshold < 75%", "Due > 14 days"
  studentId?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  teacherId?: string;
  evidence: Record<string, any>;
  detectedAt: string;
  actionCreated: boolean;
  actionId?: string;
}

export type ActionStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
export type ActionPriority = "P0" | "P1" | "P2";

export interface SchoolAction {
  id: string;
  schoolId: string;
  signalId?: string;
  title: string;
  recommendedStep: string;
  priority: ActionPriority;
  assignedToUserId?: string;
  assignedToName?: string;
  status: ActionStatus;
  notes?: string;
  outcome?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Announcement {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  channels: Array<"whatsapp" | "sms" | "in_app">;
  targetAudience: "all" | "parents" | "teachers" | "class";
  targetClassId?: string;
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  sentAt?: string;
  recipientCount: number;
  deliveryStats?: {
    delivered: number;
    failed: number;
    pending: number;
  };
}

export interface SchoolHealthScore {
  overallScore: number; // 0 - 100
  attendanceHealth: number; // 0 - 100
  financialHealth: number; // 0 - 100
  academicHealth: number; // 0 - 100
  submissionCompliance: number; // 0 - 100
  activeSignalsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
