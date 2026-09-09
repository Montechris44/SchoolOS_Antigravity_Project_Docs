# Data Model

## Core entities
School
Campus
User
Membership
Role
AcademicSession
Term
Class
Subject
ClassSubject
Student
Guardian
StudentGuardian
Enrollment
Staff
TeacherAssignment
AttendanceRecord
Assessment
Score
GradeScale
Result
ReportCard
FeeStructure
FeeItem
Invoice
InvoiceItem
Payment
Receipt
Communication
MessageTemplate
NotificationJob
IntelligenceSignal
Action
AIConversation
AIMessage
AIAction
AuditLog

## Key relationships
School 1—N Users/Memberships
School 1—N Students
Student N—N Guardians
Student 1—N Enrollments
Class 1—N Enrollments
Class N—N Subjects
Teacher N—N Classes/Subjects
Student 1—N AttendanceRecords
Student 1—N Scores
Student 1—N Invoices
Invoice 1—N Payments
Student 1—N IntelligenceSignals
Signal 1—N Actions
AIConversation 1—N AIMessages

## Tenant rule
Every school-owned entity must be scoped to a school_id, directly or through a securely enforced relationship. Row Level Security must prevent cross-school access.

## Important invariants
- Student admission number unique within a school.
- Invoice totals derive from invoice items.
- Balance = total - verified payments/refunds according to finance rules.
- Grades derive from configured grading rules.
- A payment event must be idempotent.
- Attendance cannot be duplicated for the same student/date/class session without an explicit correction workflow.
- Audit records are append-only.
