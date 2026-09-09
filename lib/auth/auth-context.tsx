"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, School, UserRole } from "@/types";
import { MOCK_USERS, MOCK_PRIMARY_SCHOOL } from "./mock-data";
import { Permission, hasPermission } from "./types";

interface AuthContextType {
  user: User | null;
  school: School | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (role?: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  switchSchool: (school: School) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default to the school proprietor / owner for immediate testing
  const [role, setRole] = useState<UserRole>("owner");
  const [user, setUser] = useState<User | null>(MOCK_USERS.owner.user);
  const [school, setSchool] = useState<School | null>(MOCK_PRIMARY_SCHOOL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  useEffect(() => {
    // Check local storage for persistent testing role
    const savedRole = localStorage.getItem("schoolos_active_role") as UserRole | null;
    if (savedRole && MOCK_USERS[savedRole]) {
      setRole(savedRole);
      setUser(MOCK_USERS[savedRole].user);
      setSchool(MOCK_USERS[savedRole].school);
    }
  }, []);

  const switchRole = (newRole: UserRole) => {
    setIsLoading(true);
    const mock = MOCK_USERS[newRole];
    if (mock) {
      setRole(newRole);
      setUser(mock.user);
      setSchool(mock.school);
      localStorage.setItem("schoolos_active_role", newRole);
    }
    setTimeout(() => setIsLoading(false), 150);
  };

  const switchSchool = (newSchool: School) => {
    setSchool(newSchool);
  };

  const login = (loginRole: UserRole = "owner") => {
    switchRole(loginRole);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
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
        logout,
        switchRole,
        switchSchool,
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
