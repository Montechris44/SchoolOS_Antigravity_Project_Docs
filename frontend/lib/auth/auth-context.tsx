"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, School, UserRole } from "@/types";
import {
  AuthSession,
  Permission,
  hasPermission,
} from "./types";
import {
  RegisterSchoolPayload,
  fetchCurrentSession,
  forceUpdatePassword as forceUpdatePasswordRequest,
  login as loginRequest,
  logoutRequest,
  registerSchool as registerSchoolRequest,
} from "@/lib/api/auth";
import {
  PASSWORD_CHANGE_REQUIRED_EVENT,
  SESSION_EXPIRED_EVENT,
  getStoredRefreshToken,
  getStoredToken,
  setStoredRefreshToken,
  setStoredToken,
} from "@/lib/api/client";

interface AuthContextType {
  user: User | null;
  school: School | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True while the account still has an admin-issued temporary password. */
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  registerSchool: (payload: RegisterSchoolPayload) => Promise<void>;
  forceUpdatePassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  updateSchoolInSession: (school: School) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("owner");
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setStoredRefreshToken(null);
    setUser(null);
    setSchool(null);
    setIsAuthenticated(false);
    setMustChangePassword(false);
  }, []);

  useEffect(() => {
    if (!getStoredToken() && !getStoredRefreshToken()) {
      setIsLoading(false);
      return;
    }

    fetchCurrentSession()
      .then((session) => {
        setUser(session.user);
        setSchool(session.school);
        setRole(session.role);
        setMustChangePassword(session.mustChangePassword);
        setIsAuthenticated(true);
      })
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));
  }, [clearSession]);

  // The API client tells us when a session can no longer be renewed, or a password change is required.
  useEffect(() => {
    const onExpired = () => clearSession();
    const onPasswordChange = () => setMustChangePassword(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChange);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, onPasswordChange);
    };
  }, [clearSession]);

  const applySession = (session: AuthSession) => {
    setStoredToken(session.token);
    setStoredRefreshToken(session.refreshToken);
    setUser(session.user);
    setSchool(session.school);
    setRole(session.role);
    setMustChangePassword(session.mustChangePassword);
    setIsAuthenticated(true);
  };

  const login = async (email: string, password: string) => {
    const session = await loginRequest({ email, password });
    applySession(session);
    return session;
  };

  const registerSchool = async (payload: RegisterSchoolPayload) => {
    applySession(await registerSchoolRequest(payload));
  };

  const forceUpdatePassword = async (newPassword: string) => {
    applySession(await forceUpdatePasswordRequest(newPassword));
  };

  const logout = () => {
    // Revoke the refresh token server-side; the local session ends regardless of the outcome.
    void logoutRequest(getStoredRefreshToken()).catch(() => undefined);
    clearSession();
  };

  const updateSchoolInSession = (updatedSchool: School) => {
    setSchool(updatedSchool);
  };

  const can = (permission: Permission): boolean => {
    return hasPermission(role, permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        role,
        isAuthenticated,
        isLoading,
        mustChangePassword,
        login,
        registerSchool,
        forceUpdatePassword,
        logout,
        updateSchoolInSession,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
