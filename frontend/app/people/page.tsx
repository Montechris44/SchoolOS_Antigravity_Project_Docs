"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listStudents, createStudent } from "@/lib/api/students";
import { listClasses, createClass } from "@/lib/api/classes";
import { listStaff } from "@/lib/api/staff";
import { listSubjects, createSubject } from "@/lib/api/subjects";
import { ApiError } from "@/lib/api/client";
import { Student, SchoolClass, Staff, Subject } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/feedback-states";
import {
  Users,
  GraduationCap,
  Briefcase,
  Plus,
  Search,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function PeopleAndClassesPage() {
  const { school } = useAuth();
  const [activeTab, setActiveTab] = useState<"students" | "classes" | "staff" | "sessions">("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  // Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [modalSuccessMsg, setModalSuccessMsg] = useState("");
  const [modalErrorMsg, setModalErrorMsg] = useState("");

  // Enrollment Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "male" as "male" | "female",
    dateOfBirth: "2014-01-15",
    classId: "",
    admissionNumber: "",
    guardianFirstName: "",
    guardianLastName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "father" as "father" | "mother" | "guardian",
  });

  // Class Form State
  const [classFormData, setClassFormData] = useState({
    name: "",
    gradeLevel: "JSS 1",
    capacity: 35,
  });
  const [classErrorMsg, setClassErrorMsg] = useState("");

  // Subject Form State
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [subjectFormData, setSubjectFormData] = useState({ name: "", code: "" });
  const [subjectErrorMsg, setSubjectErrorMsg] = useState("");

  const refreshData = async () => {
    if (!school) return;
    setLoadError(null);
    try {
      const [studentsData, classesData, staffData, subjectsData] = await Promise.all([
        listStudents(),
        listClasses(),
        listStaff(),
        listSubjects(),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
      setStaff(staffData);
      setSubjects(subjectsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load people & academic data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  // Set default classId once classes load
  useEffect(() => {
    if (classes.length > 0 && !formData.classId) {
      setFormData((prev) => ({ ...prev, classId: classes[0].id }));
    }
  }, [classes]);

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg("");
    setModalSuccessMsg("");

    if (!formData.firstName || !formData.lastName || !formData.admissionNumber) {
      setModalErrorMsg("Please provide first name, last name, and admission number.");
      return;
    }

    const targetClass = classes.find((c) => c.id === formData.classId) || classes[0];
    if (!targetClass) {
      setModalErrorMsg("Please create a class before enrolling students.");
      return;
    }

    const hasGuardianDetails = formData.guardianFirstName && formData.guardianLastName && formData.guardianPhone && formData.guardianEmail;

    try {
      await createStudent({
        admissionNumber: formData.admissionNumber.trim().toUpperCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        classId: targetClass.id,
        enrollmentStatus: "active",
        guardian: hasGuardianDetails
          ? {
              firstName: formData.guardianFirstName.trim(),
              lastName: formData.guardianLastName.trim(),
              relationship: formData.guardianRelationship,
              phone: formData.guardianPhone.trim(),
              email: formData.guardianEmail.trim(),
            }
          : undefined,
      });

      await refreshData();
      setModalSuccessMsg(`Student ${formData.firstName} ${formData.lastName} enrolled successfully!`);
      setTimeout(() => {
        setIsEnrollModalOpen(false);
        setModalSuccessMsg("");
        setFormData({
          firstName: "",
          lastName: "",
          gender: "male",
          dateOfBirth: "2014-01-15",
          classId: classes[0]?.id || "",
          admissionNumber: "",
          guardianFirstName: "",
          guardianLastName: "",
          guardianPhone: "",
          guardianEmail: "",
          guardianRelationship: "father",
        });
      }, 1200);
    } catch (err) {
      setModalErrorMsg(err instanceof ApiError ? err.message : "Failed to enroll student. Please try again.");
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classFormData.name) return;
    setClassErrorMsg("");

    try {
      await createClass({
        name: classFormData.name.trim(),
        gradeLevel: classFormData.gradeLevel,
        capacity: Number(classFormData.capacity) || 35,
      });
      await refreshData();
      setIsAddClassModalOpen(false);
      setClassFormData({ name: "", gradeLevel: "JSS 1", capacity: 35 });
    } catch (err) {
      setClassErrorMsg(err instanceof ApiError ? err.message : "Failed to create class. Please try again.");
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectFormData.name || !subjectFormData.code) return;
    setSubjectErrorMsg("");

    try {
      await createSubject({
        name: subjectFormData.name.trim(),
        code: subjectFormData.code.trim().toUpperCase(),
      });
      await refreshData();
      setIsAddSubjectModalOpen(false);
      setSubjectFormData({ name: "", code: "" });
    } catch (err) {
      setSubjectErrorMsg(err instanceof ApiError ? err.message : "Failed to create subject. Please try again.");
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClassFilter === "all" || s.currentClassId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

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
        <ErrorState message={loadError} onRetry={refreshData} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              People & Academic Structure
            </h1>
            <p className="text-sm text-slate-500">
              Manage students, guardians, staff faculty, classes, and academic sessions for {school?.name}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsAddClassModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Class
            </Button>
            <Button
              onClick={() => setIsEnrollModalOpen(true)}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Enroll Student
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "students"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4" /> Students ({students.length})
          </button>
          <button
            onClick={() => setActiveTab("classes")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "classes"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Classes ({classes.length})
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "staff"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Briefcase className="h-4 w-4" /> Staff &amp; Faculty ({staff.length})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "sessions"
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="h-4 w-4" /> Sessions &amp; Terms
          </button>
        </div>

        {/* Tab Content: STUDENTS */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by student name or admission ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Class:</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <option value="all">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table */}
            {filteredStudents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No students found"
                description="No student records match your search or filter criteria."
                actionLabel="Enroll First Student"
                onAction={() => setIsEnrollModalOpen(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-subtle">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 text-[11px] uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200/80">
                      <tr>
                        <th className="px-6 py-3.5">Admission No.</th>
                        <th className="px-6 py-3.5">Student Scholar</th>
                        <th className="px-6 py-3.5">Class</th>
                        <th className="px-6 py-3.5">Gender</th>
                        <th className="px-6 py-3.5">Parent / Guardian</th>
                        <th className="px-6 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((std) => (
                        <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5">
                            <span className="font-mono font-semibold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {std.admissionNumber}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-slate-900">
                            {std.firstName} {std.lastName}
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge variant="secondary">{std.currentClassName}</Badge>
                          </td>
                          <td className="px-6 py-3.5 capitalize text-slate-600">{std.gender}</td>
                          <td className="px-6 py-3.5">
                            <div>
                              <p className="font-medium text-slate-800">{std.guardianName || "Unassigned"}</p>
                              {std.guardianPhone && (
                                <p className="text-xs text-slate-400">{std.guardianPhone}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge variant="success">Active</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: CLASSES */}
        {activeTab === "classes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => {
              const enrolledCount = students.filter((s) => s.currentClassId === cls.id).length;
              return (
                <Card key={cls.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="default">{cls.gradeLevel}</Badge>
                      <span className="text-xs font-semibold text-slate-400">
                        Cap: {cls.capacity}
                      </span>
                    </div>
                    <CardTitle className="text-xl font-bold mt-2">{cls.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm py-2 border-t border-slate-100">
                      <span className="text-slate-500">Enrolled Scholars:</span>
                      <span className="font-bold text-slate-900">{enrolledCount} scholars</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-t border-slate-100">
                      <span className="text-slate-500">Class Form Tutor:</span>
                      <span className="font-medium text-blue-600">
                        {cls.classTeacherName || "Pending Assignment"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Tab Content: STAFF */}
        {activeTab === "staff" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {staff.map((st) => (
              <Card key={st.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold text-base">
                    {st.firstName[0]}
                    {st.lastName[0]}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        {st.firstName} {st.lastName}
                      </h3>
                      <Badge variant="secondary" className="capitalize">
                        {st.role}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-blue-700">{st.title}</p>
                    <p className="text-xs text-slate-400">{st.email} • {st.phone}</p>
                    <p className="text-xs font-mono text-slate-500 pt-1">ID: {st.employeeId}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Tab Content: SESSIONS & TERMS */}
        {activeTab === "sessions" && (
          <div className="space-y-6">
            <Card className="p-6 border-l-4 border-l-blue-600">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Active Academic Calendar
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    2026/2027 Academic Session
                  </h3>
                  <p className="text-xs text-slate-500">1 Sep 2026 – 20 Jul 2027</p>
                </div>
                <Badge variant="success">Current Active Session</Badge>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900">First Term</span>
                    <Badge variant="default">In Session</Badge>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">15 Sep 2026 – 18 Dec 2026</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Second Term</span>
                    <Badge variant="secondary">Upcoming</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">11 Jan 2027 – 08 Apr 2027</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 opacity-75">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Third Term</span>
                    <Badge variant="secondary">Upcoming</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">03 May 2027 – 23 Jul 2027</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Curriculum Subjects</CardTitle>
                <Button
                  onClick={() => setIsAddSubjectModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add Subject
                </Button>
              </div>
              {subjects.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No subjects configured yet. Add your first subject to start creating assessments.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {subjects.map((sbj) => (
                    <div
                      key={sbj.id}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white text-center hover:bg-slate-50"
                    >
                      <BookOpen className="h-5 w-5 text-blue-600 mb-1" />
                      <span className="text-xs font-bold text-slate-800">{sbj.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{sbj.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Modal: Enroll Student */}
        <Dialog
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          title="Enroll New Scholar"
          description="Register student identity, class placement, and emergency guardian contacts."
          maxWidth="lg"
        >
          <form onSubmit={handleEnrollStudent} className="space-y-4">
            {modalErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {modalErrorMsg}
              </div>
            )}
            {modalSuccessMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {modalSuccessMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                id="firstName"
                label="First Name"
                placeholder="e.g. Babatunde"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
              <Input
                id="lastName"
                label="Last Name"
                placeholder="e.g. Adeleke"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                id="admissionNumber"
                label="Admission Number"
                placeholder="e.g. ECA/2026/015"
                required
                value={formData.admissionNumber}
                onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
              />
              <Select
                id="gender"
                label="Gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as "male" | "female" })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
              <Select
                id="classId"
                label="Class Allocation"
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Primary Guardian / Parent Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  id="guardianFirstName"
                  label="Guardian First Name"
                  placeholder="e.g. Samuel"
                  value={formData.guardianFirstName}
                  onChange={(e) => setFormData({ ...formData, guardianFirstName: e.target.value })}
                />
                <Input
                  id="guardianLastName"
                  label="Guardian Last Name"
                  placeholder="e.g. Adeleke"
                  value={formData.guardianLastName}
                  onChange={(e) => setFormData({ ...formData, guardianLastName: e.target.value })}
                />
                <Input
                  id="guardianPhone"
                  label="Phone (WhatsApp enabled)"
                  placeholder="+234 803 000 0000"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                />
                <Input
                  id="guardianEmail"
                  label="Email Address"
                  type="email"
                  placeholder="guardian@example.com"
                  value={formData.guardianEmail}
                  onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsEnrollModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Complete Enrollment
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Modal: Add Class */}
        <Dialog
          isOpen={isAddClassModalOpen}
          onClose={() => setIsAddClassModalOpen(false)}
          title="Create New Classroom / Cohort"
          description="Define grade level and classroom capacity."
        >
          <form onSubmit={handleCreateClass} className="space-y-4">
            {classErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {classErrorMsg}
              </div>
            )}
            <Input
              id="className"
              label="Class Name"
              placeholder="e.g. JSS 3 Diamond"
              required
              value={classFormData.name}
              onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                id="gradeLevel"
                label="Grade Level"
                value={classFormData.gradeLevel}
                onChange={(e) => setClassFormData({ ...classFormData, gradeLevel: e.target.value })}
              >
                <option value="Primary 1">Primary 1</option>
                <option value="Primary 4">Primary 4</option>
                <option value="JSS 1">JSS 1</option>
                <option value="JSS 2">JSS 2</option>
                <option value="JSS 3">JSS 3</option>
                <option value="SS 1">SS 1</option>
                <option value="SS 2">SS 2</option>
                <option value="SS 3">SS 3</option>
              </Select>
              <Input
                id="capacity"
                label="Capacity"
                type="number"
                value={classFormData.capacity}
                onChange={(e) => setClassFormData({ ...classFormData, capacity: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsAddClassModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Classroom</Button>
            </div>
          </form>
        </Dialog>

        {/* Modal: Add Subject */}
        <Dialog
          isOpen={isAddSubjectModalOpen}
          onClose={() => setIsAddSubjectModalOpen(false)}
          title="Add Curriculum Subject"
          description="Define a subject and its short code for the timetable and gradebook."
        >
          <form onSubmit={handleCreateSubject} className="space-y-4">
            {subjectErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {subjectErrorMsg}
              </div>
            )}
            <Input
              id="subjectName"
              label="Subject Name"
              placeholder="e.g. Mathematics"
              required
              value={subjectFormData.name}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })}
            />
            <Input
              id="subjectCode"
              label="Subject Code"
              placeholder="e.g. MTH"
              required
              maxLength={20}
              value={subjectFormData.code}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value })}
            />
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsAddSubjectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Subject</Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
