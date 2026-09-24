"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Users,
  ScrollText,
  LogOut,
  Ban,
  CheckCircle2,
  Search,
  Unlock,
  AlertCircle,
} from "lucide-react";
import * as superAdminApi from "@/lib/api/super-admin";
import { getSuperAdminToken, setSuperAdminToken, ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/ui/feedback-states";
import { formatDate } from "@/lib/utils";

type Tab = "schools" | "users" | "audit";

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<superAdminApi.SuperAdmin | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [tab, setTab] = useState<Tab>("schools");
  const [analytics, setAnalytics] = useState<superAdminApi.PlatformAnalytics | null>(null);
  const [schools, setSchools] = useState<superAdminApi.PlatformSchool[]>([]);
  const [users, setUsers] = useState<superAdminApi.PlatformUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<superAdminApi.AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  const [suspendTarget, setSuspendTarget] = useState<superAdminApi.PlatformSchool | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  useEffect(() => {
    const token = getSuperAdminToken();
    if (!token) {
      router.replace("/super-admin/login");
      return;
    }

    superAdminApi
      .fetchCurrentSuperAdmin()
      .then((data) => setAdmin(data))
      .catch(() => {
        setSuperAdminToken(null);
        router.replace("/super-admin/login");
      })
      .finally(() => setIsCheckingSession(false));
  }, [router]);

  const loadSchoolsAndAnalytics = () => {
    setLoadError(null);
    Promise.all([superAdminApi.listSchools(), superAdminApi.getAnalytics()])
      .then(([schoolsData, analyticsData]) => {
        setSchools(schoolsData);
        setAnalytics(analyticsData);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load platform data."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!admin) return;
    loadSchoolsAndAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    if (!admin) return;
    if (tab === "users" && users.length === 0) {
      superAdminApi.listUsers().then(setUsers).catch(() => {});
    }
    if (tab === "audit" && auditLogs.length === 0) {
      superAdminApi.listAuditLogs().then(setAuditLogs).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, admin]);

  const handleLogout = () => {
    setSuperAdminToken(null);
    router.replace("/super-admin/login");
  };

  const handleConfirmStatusChange = async () => {
    if (!suspendTarget) return;
    setActionErrorMsg("");
    setIsSubmittingStatus(true);

    const nextStatus = suspendTarget.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

    try {
      await superAdminApi.updateSchoolStatus(suspendTarget.id, nextStatus, suspendReason || undefined);
      setSchools((prev) =>
        prev.map((s) => (s.id === suspendTarget.id ? { ...s, status: nextStatus } : s))
      );
      setActionSuccessMsg(
        `${suspendTarget.name} ${nextStatus === "SUSPENDED" ? "suspended" : "reactivated"}.`
      );
      setTimeout(() => setActionSuccessMsg(""), 3500);
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (err) {
      setActionErrorMsg(err instanceof ApiError ? err.message : "Failed to update school status.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleUnlock = async (profileId: string) => {
    setActionErrorMsg("");
    try {
      await superAdminApi.unlockProfile(profileId);
      setActionSuccessMsg("Account unlocked.");
      setTimeout(() => setActionSuccessMsg(""), 3000);
    } catch (err) {
      setActionErrorMsg(err instanceof ApiError ? err.message : "Failed to unlock account.");
    }
  };

  const filteredSchools = schools.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.slug.toLowerCase().includes(term) || s.email.toLowerCase().includes(term);
  });

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          Verifying session...
        </div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50/70">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 lg:px-8 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-heading text-lg font-bold text-slate-900 tracking-tight">SchoolOS Platform Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">{admin.fullName}</span>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadSchoolsAndAnalytics} />
        ) : (
          <>
            {actionSuccessMsg && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-2xs animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                {actionSuccessMsg}
              </div>
            )}
            {actionErrorMsg && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200 shadow-2xs animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                {actionErrorMsg}
              </div>
            )}

            {/* Platform analytics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { label: "Total Schools", value: analytics?.totalSchools, color: "text-indigo-600" },
                { label: "Active", value: analytics?.activeSchools, color: "text-emerald-600" },
                { label: "Suspended", value: analytics?.suspendedSchools, color: "text-rose-600" },
                { label: "Students", value: analytics?.totalStudents, color: "text-slate-800" },
                { label: "Staff", value: analytics?.totalStaff, color: "text-slate-800" },
                { label: "Memberships", value: analytics?.totalMemberships, color: "text-slate-800" },
              ].map((stat) => (
                <Card key={stat.label} className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-subtle hover:shadow-card-hover transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </span>
                  <p className={`font-heading text-2xl font-bold tracking-tight mt-1 ${stat.color}`}>{stat.value ?? 0}</p>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
              <button
                onClick={() => setTab("schools")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-heading font-bold transition-all ${
                  tab === "schools" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Building2 className="h-4 w-4" /> Schools ({schools.length})
              </button>
              <button
                onClick={() => setTab("users")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-heading font-bold transition-all ${
                  tab === "users" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="h-4 w-4" /> Users
              </button>
              <button
                onClick={() => setTab("audit")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-heading font-bold transition-all ${
                  tab === "audit" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ScrollText className="h-4 w-4" /> Audit Logs
              </button>
            </div>

            {tab === "schools" && (
              <div className="space-y-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, slug, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-2xl"
                  />
                </div>

                {filteredSchools.length === 0 ? (
                  <EmptyState icon={Building2} title="No schools found" description="No schools match your search." />
                ) : (
                  <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-subtle overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                          <tr>
                            <th className="px-6 py-4">School</th>
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Members</th>
                            <th className="px-6 py-4">Students</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredSchools.map((school) => (
                            <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-heading font-bold text-slate-900">{school.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{school.email}</p>
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                {school.city}, {school.state}
                              </td>
                              <td className="px-6 py-4 font-mono font-semibold text-slate-700">{school.memberCount}</td>
                              <td className="px-6 py-4 font-mono font-semibold text-slate-700">{school.studentCount}</td>
                              <td className="px-6 py-4">
                                <Badge variant={school.status === "ACTIVE" ? "success" : "destructive"} className="uppercase font-mono text-[10px]">
                                  {school.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button
                                  size="sm"
                                  variant={school.status === "ACTIVE" ? "destructive" : "outline"}
                                  className="h-8 gap-1.5 text-xs rounded-xl font-semibold cursor-pointer"
                                  onClick={() => {
                                    setSuspendTarget(school);
                                    setSuspendReason("");
                                  }}
                                >
                                  {school.status === "ACTIVE" ? (
                                    <>
                                      <Ban className="h-3.5 w-3.5" /> Suspend
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {tab === "users" && (
              <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">School</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Joined</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((user) => (
                        <tr key={user.membershipId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-heading font-bold text-slate-900">{user.fullName}</p>
                            <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">{user.schoolName}</td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className="capitalize font-mono text-[10px]">
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatDate(user.joinedAt)}</td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs rounded-xl font-semibold cursor-pointer"
                              onClick={() => handleUnlock(user.id)}
                            >
                              <Unlock className="h-3.5 w-3.5" /> Unlock login
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <EmptyState icon={Users} title="No users yet" description="No users have been created on the platform." />
                  )}
                </div>
              </Card>
            )}

            {tab === "audit" && (
              <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/90 text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                      <tr>
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">School</th>
                        <th className="px-6 py-4">Actor</th>
                        <th className="px-6 py-4">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-700 bg-indigo-50/40">{entry.action}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">{entry.schoolName ?? "—"}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {entry.superAdminName ? (
                              <span className="font-semibold text-indigo-700">{entry.superAdminName} (platform)</span>
                            ) : (
                              entry.userName ?? "System"
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">{formatDate(entry.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditLogs.length === 0 && (
                    <EmptyState icon={ScrollText} title="No audit entries yet" description="Platform activity will appear here." />
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Modal: Suspend/Reactivate confirmation */}
      {suspendTarget && (
        <Dialog
          isOpen={Boolean(suspendTarget)}
          onClose={() => setSuspendTarget(null)}
          title={suspendTarget.status === "ACTIVE" ? "Suspend school" : "Reactivate school"}
          description={
            suspendTarget.status === "ACTIVE"
              ? `${suspendTarget.name}'s users will be immediately blocked from signing in.`
              : `${suspendTarget.name}'s users will be able to sign in again.`
          }
        >
          <div className="space-y-4">
            {suspendTarget.status === "ACTIVE" && (
              <div className="w-full space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Reason (optional, recorded in the audit log)
                </label>
                <textarea
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20 shadow-2xs"
                  placeholder="e.g. Outstanding invoice, policy violation..."
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" className="rounded-xl font-semibold" onClick={() => setSuspendTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmStatusChange}
                isLoading={isSubmittingStatus}
                variant={suspendTarget.status === "ACTIVE" ? "destructive" : "primary"}
                className="rounded-xl font-semibold shadow-2xs"
              >
                {suspendTarget.status === "ACTIVE" ? "Confirm suspension" : "Confirm reactivation"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
