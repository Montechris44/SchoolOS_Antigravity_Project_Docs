import { superAdminApiRequest } from "./client";

export interface SuperAdmin {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export interface SuperAdminSession {
  superAdmin: SuperAdmin;
  token: string;
}

export function login(email: string, password: string): Promise<SuperAdminSession> {
  return superAdminApiRequest<SuperAdminSession>("/super-admin/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function fetchCurrentSuperAdmin(): Promise<SuperAdmin> {
  return superAdminApiRequest<SuperAdmin>("/super-admin/me");
}

export type SchoolStatus = "ACTIVE" | "SUSPENDED";

export interface PlatformSchool {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  city: string;
  state: string;
  country: string;
  email: string;
  phone: string;
  currency: string;
  createdAt: string;
  memberCount: string;
  studentCount: string;
  staffCount: string;
}

export function listSchools(filters: { status?: SchoolStatus; search?: string } = {}): Promise<PlatformSchool[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  return superAdminApiRequest<PlatformSchool[]>(`/super-admin/schools${query ? `?${query}` : ""}`);
}

export function updateSchoolStatus(schoolId: string, status: SchoolStatus, reason?: string): Promise<PlatformSchool> {
  return superAdminApiRequest<PlatformSchool>(`/super-admin/schools/${schoolId}/status`, {
    method: "PATCH",
    body: { status, reason },
  });
}

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  createdAt: string;
  membershipId: string;
  role: string;
  membershipActive: boolean;
  joinedAt: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
}

export function listUsers(schoolId?: string): Promise<PlatformUser[]> {
  const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
  return superAdminApiRequest<PlatformUser[]>(`/super-admin/users${query}`);
}

export function unlockProfile(profileId: string): Promise<{ profileId: string; unlocked: boolean }> {
  return superAdminApiRequest(`/super-admin/profiles/${profileId}/unlock`, { method: "POST" });
}

export interface PlatformAnalytics {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalStaff: number;
  totalMemberships: number;
}

export function getAnalytics(): Promise<PlatformAnalytics> {
  return superAdminApiRequest<PlatformAnalytics>("/super-admin/analytics");
}

export interface AuditLogEntry {
  id: string;
  schoolId: string | null;
  schoolName: string | null;
  userId: string | null;
  userName: string | null;
  superAdminId: string | null;
  superAdminName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export function listAuditLogs(filters: { schoolId?: string; action?: string } = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.schoolId) params.set("schoolId", filters.schoolId);
  if (filters.action) params.set("action", filters.action);
  const query = params.toString();
  return superAdminApiRequest<AuditLogEntry[]>(`/super-admin/audit-logs${query ? `?${query}` : ""}`);
}
