"use client";

import React from "react";
import { Mail, Palmtree } from "lucide-react";
import { getStaffDashboard } from "@/lib/api/portal-daily";
import { useAuth } from "@/lib/auth/auth-context";
import { ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import { StatCard, useLoader } from "@/components/ui/portal";
import { ClockWidget, Hero, UpcomingEvents } from "./shared";

export function StaffDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload, setData } = useLoader(getStaffDashboard, []);

  if (loading) return <LoadingSkeleton count={3} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load your dashboard."} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <Hero eyebrow="Staff workspace" title={`Hello, ${user?.fullName.split(" ")[0] ?? "there"}`} subtitle="Sign in for the day, check messages and request leave." />
      <ClockWidget status={data.staffAttendance} onChange={(next) => setData({ ...data, staffAttendance: next })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Unread messages" value={data.unread.messages} icon={Mail} href="/messages" />
        <StatCard label="Leave requests" value="Apply" icon={Palmtree} tone="amber" href="/leave" hint="Request time off" />
      </div>
      <UpcomingEvents events={data.upcomingEvents} />
    </div>
  );
}
