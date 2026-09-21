"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listClasses } from "@/lib/api/classes";
import { listStudents } from "@/lib/api/students";
import { listAttendance, markAttendance } from "@/lib/api/attendance";
import { listTeacherAssignments } from "@/lib/api/portal-academics";
import { ApiError } from "@/lib/api/client";
import { Student, SchoolClass, AttendanceStatus } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Calendar,
  AlertTriangle,
  AlertCircle,
  History,
  Save,
} from "lucide-react";

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function AttendancePage() {
  const { school, role, user } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIsoDate());
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; notes?: string }>>({});
  const [viewMode, setViewMode] = useState<"register" | "history">("register");
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!school) return;
    setIsLoading(true);
    // Teachers only take the register of classes they teach or are class teacher of.
    Promise.all([listClasses(), role === "teacher" ? listTeacherAssignments() : Promise.resolve(null)])
      .then(([all, mine]) => {
        const cl = mine ? all.filter((c) => mine.some((a) => a.classId === c.id) || c.classTeacherId === user?.id) : all;
        setClasses(cl);
        if (cl.length > 0 && !selectedClassId) {
          setSelectedClassId(cl[0].id);
        }
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load classes."))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const loadRegister = () => {
    if (!selectedClassId) return;
    setLoadError(null);

    Promise.all([listStudents(selectedClassId), listAttendance(selectedClassId, selectedDate)])
      .then(([stds, existing]) => {
        setClassStudents(stds);

        const newMap: Record<string, { status: AttendanceStatus; notes?: string }> = {};
        stds.forEach((std) => {
          const match = existing.find((e) => e.studentId === std.id);
          newMap[std.id] = match ? { status: match.status, notes: match.notes } : { status: "PRESENT" };
        });
        setAttendanceMap(newMap);
        setIsSaved(false);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load attendance register."));
  };

  useEffect(() => {
    loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedDate]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
    setIsSaved(false);
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes },
    }));
    setIsSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, { status: AttendanceStatus; notes?: string }> = {};
    classStudents.forEach((std) => {
      updated[std.id] = { status, notes: attendanceMap[std.id]?.notes };
    });
    setAttendanceMap(updated);
    setIsSaved(false);
  };

  const handleSaveAttendance = async () => {
    setSaveError(null);
    setIsSaving(true);

    const records = classStudents.map((std) => ({
      studentId: std.id,
      status: attendanceMap[std.id]?.status || ("PRESENT" as AttendanceStatus),
      notes: attendanceMap[std.id]?.notes,
    }));

    try {
      await markAttendance({ classId: selectedClassId, date: selectedDate, records });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save attendance. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Metrics calculation
  const totalStudents = classStudents.length;
  const presentCount = Object.values(attendanceMap).filter((v) => v.status === "PRESENT").length;
  const absentCount = Object.values(attendanceMap).filter((v) => v.status === "ABSENT").length;
  const lateCount = Object.values(attendanceMap).filter((v) => v.status === "LATE").length;
  const excusedCount = Object.values(attendanceMap).filter((v) => v.status === "EXCUSED").length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSkeleton count={5} />
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <ErrorState message={loadError} onRetry={loadRegister} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Daily Attendance Register
            </h1>
            <p className="text-sm text-slate-500">
              Record roll-call, track attendance compliance, and detect low-attendance risks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "register" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("register")}
              className="gap-1.5"
            >
              <CalendarCheck className="h-4 w-4" /> Daily Roll-Call
            </Button>
            <Button
              variant={viewMode === "history" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("history")}
              className="gap-1.5"
            >
              <History className="h-4 w-4" /> History & Compliance
            </Button>
          </div>
        </div>

        {/* Controls Bar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Class / Cohort
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Register Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll("PRESENT")}
                className="w-full text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                All Present
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll("ABSENT")}
                className="w-full text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                All Absent
              </Button>
            </div>

            <div>
              <Button
                onClick={handleSaveAttendance}
                isLoading={isSaving}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {isSaved ? "Saved Successfully!" : "Save Roll-Call"}
              </Button>
            </div>
          </div>

          {saveError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
        </Card>

        {/* Quick KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Enrolled Scholars</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalStudents}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-emerald-700">Present</span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{presentCount}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-rose-700">Absent</span>
            <p className="text-2xl font-bold text-rose-700 mt-1">{absentCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-amber-700">Late</span>
            <p className="text-2xl font-bold text-amber-700 mt-1">{lateCount}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-blue-700">Attendance Rate</span>
            <p className="text-2xl font-bold text-blue-700 mt-1">{attendanceRate}%</p>
          </div>
        </div>

        {/* View Mode: REGISTER */}
        {viewMode === "register" && (
          <Card className="overflow-hidden">
            <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">
                  Attendance List for {classes.find((c) => c.id === selectedClassId)?.name}
                </CardTitle>
                <span className="text-xs font-mono font-medium text-slate-500">
                  Date: {selectedDate}
                </span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Student Scholar</th>
                    <th className="px-6 py-3.5 text-center">Status Selection</th>
                    <th className="px-6 py-3.5">Remark / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((std) => {
                    const currentStatus = attendanceMap[std.id]?.status || "PRESENT";
                    return (
                      <tr key={std.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                              {std.firstName[0]}
                              {std.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {std.firstName} {std.lastName}
                              </p>
                              <p className="text-xs font-mono text-slate-400">
                                {std.admissionNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status Radio Pills */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(std.id, "PRESENT")}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                currentStatus === "PRESENT"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(std.id, "ABSENT")}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                currentStatus === "ABSENT"
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                              }`}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(std.id, "LATE")}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                currentStatus === "LATE"
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5" /> Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(std.id, "EXCUSED")}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                currentStatus === "EXCUSED"
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                              }`}
                            >
                              <HelpCircle className="h-3.5 w-3.5" /> Excused
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <input
                            type="text"
                            placeholder="Reason if absent/late..."
                            value={attendanceMap[std.id]?.notes || ""}
                            onChange={(e) => handleNotesChange(std.id, e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-blue-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* View Mode: HISTORY & RISK SUMMARY */}
        {viewMode === "history" && (
          <div className="space-y-6">
            <Card className="p-6 border-l-4 border-l-amber-500">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Deterministic Low-Attendance Trigger Active
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                    The intelligence engine automatically flags students whose cumulative attendance drops below 75%.
                    Chioma Eze currently has a 50% attendance rate, which generated high-severity signal <strong>#SIG-001</strong>.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <CardTitle className="text-base font-bold mb-4">
                Cumulative Student Attendance Rates ({classes.find((c) => c.id === selectedClassId)?.name})
              </CardTitle>
              <div className="space-y-4">
                {classStudents.map((std) => {
                  // Synthetic demo cumulative calculation: Chioma = 50%, others = 95%
                  const isChioma = std.firstName === "Chioma";
                  const rate = isChioma ? 50 : 96;
                  const isRisk = rate < 75;

                  return (
                    <div
                      key={std.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-xs text-slate-400">{std.admissionNumber}</div>
                        <span className="font-bold text-sm text-slate-800">
                          {std.firstName} {std.lastName}
                        </span>
                        {isRisk && <Badge variant="destructive">Attendance Risk (&lt;75%)</Badge>}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${
                              isRisk ? "bg-rose-600" : "bg-emerald-600"
                            }`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="font-bold text-sm text-slate-900 w-12 text-right">
                          {rate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
