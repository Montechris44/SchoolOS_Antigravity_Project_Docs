"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { ManagementDashboard } from "@/components/dashboards/management-dashboard";
import { AdminOverview } from "@/components/dashboards/admin-overview";
import { TeacherDashboard } from "@/components/dashboards/teacher-dashboard";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { ParentDashboard } from "@/components/dashboards/parent-dashboard";
import { StaffDashboard } from "@/components/dashboards/staff-dashboard";

/** One entry point for everyone: the account's role decides which workspace they see. */
export default function DashboardPage() {
  const { role, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role === "bursar") router.replace("/finance");
  }, [isLoading, isAuthenticated, role, router]);

  return (
    <AppShell>
      {(role === "owner" || role === "admin") && (
        <div className="space-y-8">
          <AdminOverview />
          <ManagementDashboard />
        </div>
      )}
      {role === "teacher" && <TeacherDashboard />}
      {role === "student" && <StudentDashboard />}
      {role === "parent" && <ParentDashboard />}
      {role === "non_academic" && <StaffDashboard />}
    </AppShell>
  );
}
