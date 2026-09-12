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

export function registerSchool(payload: RegisterSchoolPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/register-school", { method: "POST", body: payload, auth: false });
}

export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: payload, auth: false });
}

export function fetchCurrentSession(): Promise<Omit<AuthSession, "token">> {
  return apiRequest<Omit<AuthSession, "token">>("/me", { method: "GET" });
}
