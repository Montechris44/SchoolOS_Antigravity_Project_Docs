/**
 * Types for the school portal: calendar, classes, results workflow, timetable, homework, messaging, ...
 * The API speaks camelCase; these mirror the JSON exactly.
 */

// ---- Calendar -------------------------------------------------------------------
export interface PortalTerm {
  id: string;
  sessionId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
}

export interface PortalSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface AcademicStatus {
  sessions: PortalSession[];
  terms: PortalTerm[];
  currentSession: PortalSession | null;
  currentTerm: PortalTerm | null;
}

export interface AcademicPeriod {
  sessionId: string | null;
  sessionName: string | null;
  termId: string | null;
  termName: string | null;
  termIsActive: boolean;
}

// ---- Classes --------------------------------------------------------------------
export interface ClassArm {
  id: string;
  name: string;
  capacity: number;
  classTeacherId: string | null;
  classTeacherName: string | null;
  studentCount: number;
}

export interface PortalClass {
  id: string;
  name: string;
  gradeLevel: string;
  capacity: number;
  level: number | null;
  description: string | null;
  classTeacherId: string | null;
  classTeacherName: string | null;
  studentCount: number;
  arms: ClassArm[];
}

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  source: "GLOBAL" | "CUSTOM";
}

export interface CatalogSubject {
  id: string;
  name: string;
  code: string | null;
  category: string;
  alreadyAdded: boolean;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  armId: string | null;
  subjectId: string;
  classLabel: string;
  subjectName: string;
}

// ---- People ---------------------------------------------------------------------
export interface StaffMember {
  id: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  title: string;
  isActive: boolean;
  gender: string | null;
  qualification: string | null;
  department: string | null;
  yearsOfExperience: number | null;
  joinDate: string | null;
  address: string | null;
  dateOfBirth: string | null;
  lastLoginAt: string | null;
  forcePasswordChange: boolean;
  subjects: string[];
  classTeacherArmName: string | null;
  classTeacherClassName: string | null;
  temporaryPassword?: string;
}

export interface StudentRecord {
  id: string;
  userId: string | null;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  dateOfBirth: string | null;
  currentClassId: string;
  currentClassName: string;
  armId: string | null;
  armName: string | null;
  classLabel: string;
  guardianId: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  enrollmentStatus: "active" | "graduated" | "transferred" | "suspended";
  enrolledDate: string;
  photoUrl: string | null;
  address: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  loginEmail: string | null;
  hasLogin: boolean;
  mustChangePassword: boolean;
}

export interface Credentials {
  email: string;
  temporaryPassword: string;
}

// ---- Results --------------------------------------------------------------------
export interface CaComponent {
  key: string;
  name: string;
  max_score: number;
}

export interface CaScheme {
  id: string;
  components: CaComponent[];
  examMaxScore: number;
}

export interface MyClass {
  id: string;
  classId: string;
  armId: string | null;
  subjectId: string;
  className: string;
  armName: string | null;
  subjectName: string;
  subjectCode: string;
  classLabel: string;
}

export type BatchStatus =
  | "DRAFT"
  | "PUBLISHED_TO_CLASS_TEACHER"
  | "NEEDS_REPUBLISH"
  | "PENDING_REVIEW"
  | "RETURNED_FOR_CORRECTION"
  | "APPROVED"
  | "PUBLISHED";

export interface EntrySheetRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  caComponents: Record<string, number | null>;
  examScore: number | null;
  scoresComplete: boolean;
  computedTotal: number | null;
  grade: string | null;
  remark: string | null;
  subjectRemark: string | null;
  subjectPosition: number | null;
  subjectPositionLabel: string;
}

export interface EntrySheet {
  scheme: CaScheme | null;
  batch: { id: string | null; status: BatchStatus; reviewNotes: string | null };
  students: EntrySheetRow[];
}

export interface ClassSummaryRow {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  grandTotal: number;
  average: number;
  counts: Record<string, number>;
  position: number;
  positionLabel: string;
  positioningMode: string;
}

export interface ClassTeacherBatch {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string | null;
  status: BatchStatus;
  reviewNotes: string | null;
  studentCount: number;
  canReturn: boolean;
}

export interface ClassTeacherOverview {
  homeroom: { classId: string; armId: string | null; className: string; armName: string | null; classLabel: string };
  batches: ClassTeacherBatch[];
  notStarted: Array<{ subjectId: string; subjectName: string }>;
  editAudits: Array<{ id: string; createdAt: string; subjectName: string; studentFirstName: string; studentLastName: string; editorName: string }>;
  classSummary: ClassSummaryRow[];
  stats: { totalSubjects: number; readyForAdmin: number; pendingAdmin: number; approved: number; needsAttention: number; canSubmitToAdmin: boolean };
}

export interface QueueItem {
  id: string;
  classId: string;
  armId: string | null;
  termId: string;
  sessionId: string;
  status: BatchStatus;
  queueStatus: "PENDING" | "APPROVED" | "RELEASED" | "RETURNED" | "OTHER";
  subjectName: string;
  subjectCode: string;
  classLabel: string;
  teacherName: string | null;
  submittedByName: string | null;
  submittedToAdminAt: string | null;
  termSessionLabel: string;
  studentsCount: number;
  reviewNotes: string | null;
}

export interface QueueMetrics {
  totalSubmissions: number;
  pendingReview: number;
  approved: number;
  released: number;
}

export interface PublishReadiness {
  totalSubjects: number;
  approvedSubjects: number;
  publishedSubjects: number;
  pendingSubjects: number;
  returnedSubjects: number;
  canPublish: boolean;
  alreadyReleased: boolean;
}

export interface BatchDetail {
  batch: QueueItem & { teacherName: string | null };
  scheme: CaScheme | null;
  gradingScheme: Array<{ grade: string; minScore: number; maxScore: number; remark: string | null }>;
  students: EntrySheetRow[];
  publishReadiness: PublishReadiness;
}

export interface GradeBand {
  id?: string;
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string | null;
  isPass: boolean;
}

export interface SubjectScore {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string | null;
  caComponents: Record<string, number | null>;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  gradeRemark: string | null;
  subjectRemark: string | null;
}

export interface StudentResult {
  id: string;
  studentId: string;
  termId: string;
  sessionId: string;
  termName: string;
  sessionName: string;
  className: string;
  armName: string | null;
  approvalStatus: string;
  totalScore: number | null;
  averageScore: number | null;
  position: number | null;
  positionSuffix: string | null;
  classSize: number | null;
  totalSubjects: number;
  passedSubjects: number;
  failedSubjects: number;
  teacherRemark: string | null;
  principalRemark: string | null;
  publishedAt: string | null;
  subjects: SubjectScore[];
}

export interface ReportCardData {
  id: string;
  termName: string;
  sessionName: string;
  className: string;
  armName: string | null;
  totalScore: number | null;
  averageScore: number | null;
  position: number | null;
  positionSuffix: string | null;
  classSize: number | null;
  totalSubjects: number;
  passedSubjects: number;
  failedSubjects: number;
  teacherRemark: string | null;
  principalRemark: string | null;
  nextTermBegins: string | null;
  termEndingDate: string | null;
  school: { name: string; logoUrl: string | null; address: string; city: string; state: string; phone: string; email: string };
  student: { id: string; admissionNumber: string; firstName: string; lastName: string; middleName: string | null; gender: string; dateOfBirth: string | null; photoUrl: string | null };
  subjects: Array<{ subjectName: string; subjectCode: string; caComponents: Record<string, number | null>; examScore: number | null; totalScore: number; grade: string; gradeRemark: string | null; subjectRemark: string | null; teacherName: string | null }>;
  gradingScale: Array<{ grade: string; minScore: number; maxScore: number; remark: string | null }>;
}

// ---- Attendance -----------------------------------------------------------------
export type StudentAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface RosterRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  status: StudentAttendanceStatus | null;
  notes: string | null;
  onLeave: boolean;
}

export interface AttendanceOverview {
  date: string;
  range: { from: string; to: string };
  metrics: { overallAttendancePct: number; totalSessions: number; classesTracked: number; avgAbsentRate: number };
  dailyRecords: Array<{
    classId: string;
    className: string;
    armName: string | null;
    recordedBy: string | null;
    present: number;
    late: number;
    excused: number;
    absent: number;
    total: number;
    students: Array<{ id: string; name: string; admissionNumber: string; status: StudentAttendanceStatus; notes: string | null }>;
  }>;
  classSummary: Array<{ classId: string; className: string; sessions: number; present: number; late: number; absent: number; total: number; attendancePct: number }>;
}

export interface AttendanceHistory {
  range: { from: string; to: string };
  summary: { present: number; late: number; excused: number; absent: number; total: number; attendancePct: number };
  records: Array<{ date: string; status: StudentAttendanceStatus; notes: string | null }>;
}

export type StaffAttendanceStatus = "ON_TIME" | "LATE" | "VERY_LATE" | "ABSENT" | "ON_LEAVE";

export interface StaffSession {
  attendanceDate: string;
  isOpen: boolean;
  exists: boolean;
  openedAt?: string | null;
  closedAt?: string | null;
  openedByName?: string | null;
}

export interface StaffRegisterRow {
  userId: string;
  name: string;
  employeeId: string;
  role: string;
  subject: string | null;
  signInTime: string | null;
  signOutTime: string | null;
  status: StaffAttendanceStatus;
  notes: string | null;
}

export interface MyStaffStatus {
  date: string;
  session: StaffSession;
  cutoffs: { onTime: string; veryLate: string };
  record: { signInTime: string | null; signOutTime: string | null; status: StaffAttendanceStatus; notes: string | null } | null;
  canClockIn: boolean;
  canClockOut: boolean;
}

export interface MyStaffMonth {
  month: string;
  summary: { onTime: number; late: number; veryLate: number; absent: number; onLeave: number; daysRecorded: number; attendanceRate: number };
  records: Array<{ date: string; signInTime: string | null; signOutTime: string | null; status: StaffAttendanceStatus; notes: string | null }>;
}

// ---- Timetable ------------------------------------------------------------------
export interface TimetableEntry {
  id: string;
  classId: string;
  armId: string | null;
  termId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectName: string | null;
  teacherName: string | null;
  className: string;
  armName: string | null;
  displayTitle: string;
  isBreak: boolean;
  isLunch: boolean;
}

// ---- Homework -------------------------------------------------------------------
export interface HomeworkItem {
  id: string;
  classId: string;
  armId: string | null;
  className: string;
  armName: string | null;
  subjectName: string | null;
  teacherName: string | null;
  title: string;
  description: string | null;
  points: number;
  dueDate: string | null;
  status: string;
  submittedCount?: number;
  gradedCount?: number;
  submissionStatus?: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  gradeScore?: number | null;
  feedback?: string | null;
  submissionText?: string | null;
}

export interface SubmissionRow {
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  submissionText: string | null;
  gradeScore: number | null;
  feedback: string | null;
  submittedAt: string | null;
  files: Array<{ id: string; name: string; url: string }>;
}

// ---- Messaging & notifications ---------------------------------------------------
export interface Contact {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface MessageItem {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  parentId: string | null;
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  recipientName?: string;
}

export interface BroadcastItem {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
  senderName?: string;
  readAt?: string | null;
  className?: string | null;
  armName?: string | null;
  recipientCount?: number;
  readCount?: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

// ---- Events & leave ---------------------------------------------------------------
export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: "ACADEMIC" | "SOCIAL" | "SPORTS" | "EXAMINATION" | "HOLIDAY" | "OTHER";
  startDate: string;
  endDate: string | null;
  location: string | null;
  isPublic: boolean;
}

export interface LeavePass {
  id: string;
  studentId: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  requestedByName: string | null;
}

export interface StaffLeave {
  id: string;
  staffUserId: string;
  staffName: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewNotes: string | null;
}

// ---- Settings & dashboards ---------------------------------------------------------
export interface PortalSettings {
  passMark: number;
  maxScore: number;
  rankingMode: "AUTO" | "AVERAGE" | "SSS_GRADE_COUNTS";
  allowParentPortal: boolean;
  allowStudentPortal: boolean;
  timezone: string;
  staffSignInCutoff: string;
  staffVeryLateCutoff: string;
  schoolId: string;
  schoolName: string;
  slug: string;
  logoUrl: string | null;
  themeColor: string | null;
  schoolCode: string | null;
  studentEmailDomain: string | null;
}

export interface AdminDashboard {
  period: AcademicPeriod;
  stats: {
    students: number;
    teachers: number;
    staff: number;
    classes: number;
    attendanceToday: { present: number; marked: number };
    staffSignedInToday: number;
    results: { pendingReview: number; returned: number };
  };
  recentActivity: Array<{ id: string; action: string; resourceType: string; createdAt: string; actorName: string | null }>;
  upcomingEvents: Array<{ id: string; title: string; eventType: string; startDate: string; endDate: string | null; location: string | null }>;
}

export interface TeacherDashboard {
  period: AcademicPeriod;
  stats: { classes: number; subjects: number; students: number };
  homeroom: { classId: string; className: string; armId: string | null; armName: string | null } | null;
  needsAttention: Array<{ id: string; subjectName: string; className: string; armName: string | null; reviewNotes: string | null; status: BatchStatus }>;
  todaySchedule: TimetableEntry[];
  unread: { notifications: number; messages: number };
  upcomingEvents: AdminDashboard["upcomingEvents"];
  staffAttendance: MyStaffStatus;
}

export interface StudentDashboard {
  student: { id: string; admissionNumber: string; firstName: string; lastName: string; photoUrl: string | null; className: string; armName: string | null };
  period: AcademicPeriod;
  today: { holiday?: { title: string }; message?: string; schedule: TimetableEntry[] };
  nextClass: TimetableEntry | null;
  assignments: { total: number; pending: number; overdue: number; submitted: number; graded: number };
  attendance: { present: number; late: number; excused: number; absent: number; total: number; attendancePct: number };
  latestResult: { termName: string; sessionName: string; average: number | null; position: number | null; positionSuffix: string | null; classSize: number | null; subjects: number } | null;
  fees: { outstanding: number; invoices: number };
  unread: { notifications: number; messages: number };
  upcomingEvents: AdminDashboard["upcomingEvents"];
}

export interface ParentChild {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  className: string;
  armName: string | null;
  attendancePct: number | null;
  outstandingBalance: number;
  latestResult: { termId: string; termName: string; average: number | null; position: number | null; positionSuffix: string | null } | null;
}
