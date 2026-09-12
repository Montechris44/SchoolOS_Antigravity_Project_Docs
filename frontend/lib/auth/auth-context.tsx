"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, School, UserRole } from "@/types";
import { fetchCurrentSession, login as loginRequest, registerSchool as registerSchoolRequest } from "@/lib/api/auth";
import { RegisterSchoolPayload } from "@/lib/api/auth";
import { getStoredToken, setStoredToken } from "@/lib/api/client";
import { Permission, hasPermission } from "./types";

interface AuthContextType {
  user: User | null;
  school: School | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerSchool: (payload: RegisterSchoolPayload) => Promise<void>;
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

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetchCurrentSession()
      .then((session) => {
        setUser(session.user);
        setSchool(session.school);
        setRole(session.role);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setStoredToken(null);
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const applySession = (session: { user: User; school: School; role: UserRole; token: string }) => {
    setStoredToken(session.token);
    setUser(session.user);
    setSchool(session.school);
    setRole(session.role);
    setIsAuthenticated(true);
  };

  const login = async (email: string, password: string) => {
    const session = await loginRequest({ email, password });
    applySession(session);
  };

  const registerSchool = async (payload: RegisterSchoolPayload) => {
    const session = await registerSchoolRequest(payload);
    applySession(session);
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setSchool(null);
    setIsAuthenticated(false);
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
        login,
        registerSchool,
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
