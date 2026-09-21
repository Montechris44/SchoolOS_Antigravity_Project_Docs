import {
  AcademicStatus,
  BatchDetail,
  CaScheme,
  CatalogSubject,
  ClassTeacherOverview,
  EntrySheet,
  GradeBand,
  MyClass,
  PortalClass,
  PortalSettings,
  PortalTerm,
  PortalSession,
  PublishReadiness,
  QueueItem,
  QueueMetrics,
  ReportCardData,
  StudentResult,
  SubjectItem,
  TeacherAssignment,
} from "@/types/portal";
import { apiRequest, apiUpload } from "./client";

const qs = (params: Record<string, string | number | boolean | null | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : "";
};

// ---- Calendar -------------------------------------------------------------------
export const getAcademicStatus = () => apiRequest<AcademicStatus>("/academic-status");
export const createSession = (body: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
  apiRequest<PortalSession>("/academic-sessions", { method: "POST", body });
export const setCurrentSession = (id: string) => apiRequest<PortalSession>(`/academic-sessions/${id}/set-current`, { method: "PATCH" });
export const createTerm = (body: { sessionId: string; name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
  apiRequest<PortalTerm>("/terms", { method: "POST", body });
export const setCurrentTerm = (id: string) => apiRequest<PortalTerm>(`/terms/${id}/set-current`, { method: "PATCH" });
export const deactivateTerm = (id: string) => apiRequest<PortalTerm>(`/terms/${id}/deactivate`, { method: "PATCH" });
export const reactivateTerm = (id: string) => apiRequest<PortalTerm>(`/terms/${id}/reactivate`, { method: "PATCH" });

// ---- Classes, arms, subjects, assignments -----------------------------------------
export const listPortalClasses = () => apiRequest<PortalClass[]>("/classes");
export const createPortalClass = (body: { name: string; gradeLevel: string; capacity?: number; level?: number }) =>
  apiRequest<PortalClass>("/classes", { method: "POST", body });
export const deleteClass = (id: string) => apiRequest(`/classes/${id}`, { method: "DELETE" });
export const createArm = (body: { classId: string; name: string; capacity?: number }) =>
  apiRequest<PortalClass>("/class-arms", { method: "POST", body });
export const deleteArm = (id: string) => apiRequest(`/class-arms/${id}`, { method: "DELETE" });
export const assignArmTeacher = (armId: string, teacherId: string) =>
  apiRequest(`/class-arms/${armId}/class-teacher`, { method: "PATCH", body: { teacherId } });
export const clearArmTeacher = (armId: string) => apiRequest(`/class-arms/${armId}/class-teacher`, { method: "DELETE" });
export const assignClassTeacher = (classId: string, teacherId: string) =>
  apiRequest(`/classes/${classId}/class-teacher`, { method: "PATCH", body: { teacherId } });
export const clearClassTeacher = (classId: string) => apiRequest(`/classes/${classId}/class-teacher`, { method: "DELETE" });

export const listSubjectItems = () => apiRequest<SubjectItem[]>("/subjects");
export const createSubjectItem = (body: { name: string; code: string; description?: string }) =>
  apiRequest<SubjectItem>("/subjects", { method: "POST", body });
export const updateSubjectItem = (id: string, body: { name?: string; code?: string; description?: string | null }) =>
  apiRequest<SubjectItem>(`/subjects/${id}`, { method: "PATCH", body });
export const toggleSubjectItem = (id: string) => apiRequest<SubjectItem>(`/subjects/${id}/toggle`, { method: "PATCH" });
export const listSubjectCatalog = () => apiRequest<CatalogSubject[]>("/subjects/catalog");
export const addSubjectsFromCatalog = (globalSubjectIds: string[]) =>
  apiRequest<{ added: SubjectItem[]; skipped: string[] }>("/subjects/from-catalog", { method: "POST", body: { globalSubjectIds } });

export const listTeacherAssignments = (params: { teacherId?: string; classId?: string } = {}) =>
  apiRequest<TeacherAssignment[]>(`/teacher-assignments${qs(params)}`);
export const createTeacherAssignment = (body: { teacherId: string; classId: string; armId?: string | null; subjectId: string }) =>
  apiRequest<TeacherAssignment>("/teacher-assignments", { method: "POST", body });
export const deleteTeacherAssignment = (id: string) => apiRequest(`/teacher-assignments/${id}`, { method: "DELETE" });

// ---- Grading & settings ----------------------------------------------------------------
export const getGradeBands = () => apiRequest<GradeBand[]>("/grading-system");
export const saveGradeBands = (bands: GradeBand[]) =>
  apiRequest<GradeBand[]>("/grading-system", {
    method: "PUT",
    body: { bands: bands.map((b) => ({ minScore: b.minScore, maxScore: b.maxScore, grade: b.grade, remark: b.remark, isPass: b.isPass })) },
  });

export const getPortalSettings = () => apiRequest<PortalSettings>("/school-settings");
export interface PortalSettingsPatch {
  passMark?: number;
  rankingMode?: PortalSettings["rankingMode"];
  allowParentPortal?: boolean;
  allowStudentPortal?: boolean;
  staffSignInCutoff?: string;
  staffVeryLateCutoff?: string;
  themeColor?: string | null;
  studentEmailDomain?: string | null;
  schoolCode?: string | null;
}
export const updatePortalSettings = (body: PortalSettingsPatch) =>
  apiRequest<PortalSettings>("/school-settings", { method: "PATCH", body });
export const uploadSchoolLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<{ logoUrl: string }>("/school-settings/logo", form);
};

// ---- Results: subject teacher -------------------------------------------------------------
export interface ResultScope {
  classId: string;
  armId?: string | null;
  subjectId: string;
  termId: string;
  sessionId: string;
}

export const listMyResultClasses = () => apiRequest<MyClass[]>("/results/my-classes");
export const getEntrySheet = (scope: ResultScope) =>
  apiRequest<EntrySheet>(`/results/entry-sheet${qs({ classId: scope.classId, armId: scope.armId, subjectId: scope.subjectId, termId: scope.termId, sessionId: scope.sessionId })}`);
export const saveScheme = (scope: ResultScope, components: Array<{ name: string; maxScore: number; key?: string }>, examMaxScore: number) =>
  apiRequest<CaScheme>("/results/ca-scheme", { method: "POST", body: { ...scope, components, examMaxScore } });
export const saveScores = (
  scope: ResultScope,
  scores: Array<{ studentId: string; caComponents: Record<string, number | null>; examScore: number | null; remark?: string | null }>
) => apiRequest<{ batchId: string; status: string; saved: number }>("/results/scores", { method: "POST", body: { ...scope, scores } });
export const publishSubject = (scope: ResultScope) =>
  apiRequest<{ batchId: string; status: string }>("/results/publish-to-class-teacher", { method: "POST", body: scope });

// ---- Results: class teacher --------------------------------------------------------------------
export const getClassTeacherOverview = (termId: string, sessionId?: string) =>
  apiRequest<ClassTeacherOverview>(`/results/class-teacher-overview${qs({ termId, sessionId })}`);
export const getClassTeacherSheet = (subjectId: string, termId: string, sessionId?: string) =>
  apiRequest<{ scheme: CaScheme | null; students: EntrySheet["students"]; batch: { status: string } | null; canReturn: boolean }>(
    `/results/class-teacher-subject-sheet${qs({ subjectId, termId, sessionId })}`
  );
export const returnSubjectToTeacher = (subjectId: string, termId: string, reviewNotes: string) =>
  apiRequest("/results/class-teacher-return", { method: "POST", body: { subjectId, termId, reviewNotes } });
export const submitClassToAdmin = (termId: string, sessionId: string, teacherRemark?: string) =>
  apiRequest<{ submittedSubjects: number }>("/results/class-teacher-publish", { method: "POST", body: { termId, sessionId, teacherRemark } });

// ---- Results: administrator -----------------------------------------------------------------
export const getApprovalQueue = (params: { sessionId?: string; termId?: string; classId?: string; status?: string; search?: string }) =>
  apiRequest<QueueItem[]>(`/results/approval-queue${qs(params)}`);
export const getApprovalMetrics = (params: { sessionId?: string; termId?: string }) =>
  apiRequest<QueueMetrics>(`/results/approval-queue/metrics${qs(params)}`);
export const getBatchDetail = (batchId: string) => apiRequest<BatchDetail>(`/results/approval-queue/${batchId}`);
export const approveBatch = (batchId: string) => apiRequest(`/results/approval-queue/${batchId}/approve`, { method: "POST" });
export const returnBatch = (batchId: string, reviewNotes: string) =>
  apiRequest(`/results/approval-queue/${batchId}/return`, { method: "POST", body: { reviewNotes } });
export const getPublishReadiness = (p: { classId: string; armId?: string | null; termId: string; sessionId: string }) =>
  apiRequest<PublishReadiness>(`/results/approval-queue/publish-readiness${qs(p)}`);
export const releaseClass = (p: { classId: string; armId?: string | null; termId: string; sessionId: string; principalRemark?: string }) =>
  apiRequest<{ publishedCount: number }>("/results/approval-queue/publish-class", { method: "POST", body: p });

// ---- Results: students, parents, staff review ------------------------------------------------------
export const getMyResults = (termId?: string) => apiRequest<StudentResult[]>(`/results/my${qs({ termId })}`);
export const getPublishedResults = (studentId: string, termId?: string) =>
  apiRequest<StudentResult[]>(`/results/published/${studentId}${qs({ termId })}`);
export const getReportCard = (params: { studentId?: string; termId?: string }) => apiRequest<ReportCardData>(`/results/report-card${qs(params)}`);
