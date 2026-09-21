import { AuthSession } from "@/lib/auth/types";
import { apiRequest } from "./client";

export interface RegisterSchoolPayload {
  school: {
    name: string;
    address: string;
    city: string;
    state: string;
    country?: string;
    phone: string;
    email: string;
    currency?: string;
    logoUrl?: string;
  };
  owner: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type CurrentSession = Omit<AuthSession, "token" | "refreshToken">;

export function registerSchool(payload: RegisterSchoolPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/register-school", { method: "POST", body: payload, auth: false });
}

export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: payload, auth: false });
}

export function fetchCurrentSession(): Promise<CurrentSession> {
  return apiRequest<CurrentSession>("/me", { method: "GET" });
}

export function logoutRequest(refreshToken: string | null): Promise<unknown> {
  return apiRequest("/auth/logout", { method: "POST", body: refreshToken ? { refreshToken } : {} });
}

export function forceUpdatePassword(newPassword: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/force-update-password", { method: "POST", body: { newPassword } });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest("/auth/forgot-password", { method: "POST", body: { email }, auth: false });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiRequest("/auth/reset-password", { method: "POST", body: { token, newPassword }, auth: false });
}
