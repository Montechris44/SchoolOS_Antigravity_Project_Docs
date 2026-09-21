import {
  AdminDashboard,
  AttendanceHistory,
  AttendanceOverview,
  BroadcastItem,
  Contact,
  HomeworkItem,
  LeavePass,
  MessageItem,
  MyStaffMonth,
  MyStaffStatus,
  NotificationItem,
  ParentChild,
  RosterRow,
  SchoolEvent,
  StaffLeave,
  StaffRegisterRow,
  StaffSession,
  StudentAttendanceStatus,
  StudentDashboard,
  SubmissionRow,
  TeacherDashboard,
  TimetableEntry,
} from "@/types/portal";
import { apiRequest, apiUpload } from "./client";

const qs = (params: Record<string, string | number | boolean | null | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : "";
};

// ---- Student attendance ------------------------------------------------------------
export const getRoster = (classId: string, date: string, armId?: string) => apiRequest<RosterRow[]>(`/attendance/roster${qs({ classId, armId, date })}`);
export const markRegister = (classId: string, date: string, records: Array<{ studentId: string; status: StudentAttendanceStatus; notes?: string }>, armId?: string | null) =>
  apiRequest("/attendance", { method: "POST", body: { classId, armId, date, records } });
export const getAttendanceOverview = (params: { date?: string; from?: string; to?: string; classId?: string }) =>
  apiRequest<AttendanceOverview>(`/attendance/overview${qs(params)}`);
export const getMyAttendance = () => apiRequest<AttendanceHistory>("/attendance/me");
export const getChildAttendance = (studentId: string) => apiRequest<AttendanceHistory>(`/attendance/students/${studentId}`);

// ---- Staff attendance ---------------------------------------------------------------
export const getStaffRegister = (date?: string) => apiRequest<{ session: StaffSession; records: StaffRegisterRow[] }>(`/staff-attendance${qs({ date })}`);
export const openStaffSession = (date?: string) => apiRequest<StaffSession>("/staff-attendance/session/open", { method: "POST", body: { date } });
export const closeStaffSession = (date?: string) => apiRequest<StaffSession>("/staff-attendance/session/close", { method: "POST", body: { date } });
export const markStaff = (body: { staffUserId: string; attendanceDate: string; status: string; notes?: string }) =>
  apiRequest("/staff-attendance/mark", { method: "POST", body });
export const getMyStaffStatus = () => apiRequest<MyStaffStatus>("/staff-attendance/me");
export const getMyStaffMonth = (month?: string) => apiRequest<MyStaffMonth>(`/staff-attendance/me/history${qs({ month })}`);
export const clockIn = () => apiRequest<MyStaffStatus>("/staff-attendance/clock-in", { method: "POST" });
export const clockOut = () => apiRequest<MyStaffStatus>("/staff-attendance/clock-out", { method: "POST" });

// ---- Timetable ------------------------------------------------------------------------
export interface TimetableBody {
  classId: string;
  armId?: string | null;
  termId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}
export const listTimetable = (params: { classId?: string; armId?: string; teacherId?: string; termId?: string } = {}) =>
  apiRequest<TimetableEntry[]>(`/timetable${qs(params)}`);
export const createTimetableEntry = (body: TimetableBody) => apiRequest<TimetableEntry>("/timetable", { method: "POST", body });
export const deleteTimetableEntry = (id: string) => apiRequest(`/timetable/${id}`, { method: "DELETE" });
export const getStudentTimetable = () => apiRequest<TimetableEntry[]>("/student/timetable");
export const getTeacherTimetable = () => apiRequest<TimetableEntry[]>("/teacher/timetable");
export const getClassTimetable = (classId: string) => apiRequest<TimetableEntry[]>(`/classes/${classId}/timetable`);

// ---- Homework ---------------------------------------------------------------------------
export const listHomework = (classId?: string) => apiRequest<HomeworkItem[]>(`/assignments${qs({ classId })}`);
export const createHomework = (body: { classId: string; armId?: string | null; subjectId?: string | null; title: string; description?: string; points?: number; dueDate?: string | null }) =>
  apiRequest<HomeworkItem>("/assignments", { method: "POST", body });
export const deleteHomework = (id: string) => apiRequest(`/assignments/${id}`, { method: "DELETE" });
export const listSubmissions = (id: string) => apiRequest<{ assignment: HomeworkItem; submissions: SubmissionRow[] }>(`/assignments/${id}/submissions`);
export const gradeSubmission = (id: string, studentId: string, gradeScore: number, feedback?: string) =>
  apiRequest(`/assignments/${id}/submissions/${studentId}/grade`, { method: "PATCH", body: { gradeScore, feedback } });
export const listMyHomework = () => apiRequest<HomeworkItem[]>("/assignments/my");
export const submitHomework = (id: string, submissionText: string, status: "IN_PROGRESS" | "SUBMITTED") =>
  apiRequest<HomeworkItem>(`/assignments/my/${id}`, { method: "PATCH", body: { submissionText, status } });
export const attachHomeworkFile = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiUpload(`/assignments/my/${id}/files`, form);
};

// ---- Messaging & notifications ------------------------------------------------------------
export const listContacts = () => apiRequest<Contact[]>("/messages/contacts");
export const getInbox = () => apiRequest<MessageItem[]>("/messages/inbox");
export const getSent = () => apiRequest<MessageItem[]>("/messages/sent");
export const getThread = (id: string) => apiRequest<Array<MessageItem & { senderName: string }>>(`/messages/${id}/thread`);
export const sendMessage = (body: { recipientId: string; subject?: string; body: string; parentId?: string }) =>
  apiRequest("/messages", { method: "POST", body });
export const markMessageRead = (id: string) => apiRequest(`/messages/${id}/read`, { method: "PATCH" });
export const listBroadcasts = () => apiRequest<BroadcastItem[]>("/messages/broadcasts");
export const sendBroadcast = (body: { classId?: string; armId?: string | null; subject?: string; body: string }) =>
  apiRequest<{ recipientCount: number }>("/messages/broadcast", { method: "POST", body });
export const markBroadcastRead = (id: string) => apiRequest(`/messages/broadcasts/${id}/read`, { method: "PATCH" });

export const listNotifications = (unread = false) => apiRequest<NotificationItem[]>(`/notifications${qs({ unread: unread ? "true" : undefined })}`);
export const getUnreadCount = () => apiRequest<{ unread: number }>("/notifications/unread-count");
export const markNotificationRead = (id: string) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
export const markAllNotificationsRead = () => apiRequest("/notifications/read-all", { method: "PATCH" });

// ---- Events & leave ----------------------------------------------------------------------------
export const listEvents = (upcoming = false) => apiRequest<SchoolEvent[]>(`/events${qs({ upcoming: upcoming ? "true" : undefined })}`);
export const createEvent = (body: Omit<SchoolEvent, "id">) => apiRequest<SchoolEvent>("/events", { method: "POST", body });
export const deleteEvent = (id: string) => apiRequest(`/events/${id}`, { method: "DELETE" });

export const listLeavePasses = (status?: string) => apiRequest<LeavePass[]>(`/leave-passes${qs({ status })}`);
export const createLeavePass = (body: { studentId: string; leaveType?: string; reason: string; startDate: string; endDate: string }) =>
  apiRequest<LeavePass>("/leave-passes", { method: "POST", body });
export const reviewLeavePass = (id: string, status: "APPROVED" | "REJECTED" | "CANCELLED", rejectionReason?: string) =>
  apiRequest(`/leave-passes/${id}`, { method: "PATCH", body: { status, rejectionReason } });
export const listStaffLeave = () => apiRequest<StaffLeave[]>("/staff-leave");
export const listMyStaffLeave = () => apiRequest<StaffLeave[]>("/staff-leave/mine");
export const requestStaffLeave = (body: { leaveType?: string; reason: string; startDate: string; endDate: string }) =>
  apiRequest("/staff-leave", { method: "POST", body });
export const reviewStaffLeave = (id: string, status: "APPROVED" | "REJECTED", reviewNotes?: string) =>
  apiRequest(`/staff-leave/${id}/review`, { method: "PATCH", body: { status, reviewNotes } });
export const cancelStaffLeave = (id: string) => apiRequest(`/staff-leave/${id}/cancel`, { method: "PATCH" });

// ---- Dashboards -----------------------------------------------------------------------------------
export const getAdminDashboard = () => apiRequest<AdminDashboard>("/dashboard/admin");
export const getTeacherDashboard = () => apiRequest<TeacherDashboard>("/dashboard/teacher");
export const getStudentDashboard = () => apiRequest<StudentDashboard>("/dashboard/student");
export const getStaffDashboard = () =>
  apiRequest<{ unread: { notifications: number; messages: number }; upcomingEvents: AdminDashboard["upcomingEvents"]; staffAttendance: MyStaffStatus }>("/dashboard/staff");
export const listParentChildren = () => apiRequest<ParentChild[]>("/parent/children");
export const getStudentFees = () =>
  apiRequest<Array<{ id: string; invoiceNumber: string; termName: string; totalAmount: number; amountPaid: number; balanceDue: number; status: string; dueDate: string; items: Array<{ description: string; amount: number }> }>>(
    "/student/fees"
  );
