"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/db/mock-db";
import { Student, SchoolClass, Subject, Assessment, Score, ReportCard } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback-states";
import {
  getGradeForScore,
  compileSubjectResult,
  generateReportCard,
} from "@/modules/academics/grading-engine";
import {
  GraduationCap,
  Award,
  BookOpen,
  FileSpreadsheet,
  Plus,
  Save,
  CheckCircle2,
  Printer,
  Calendar,
  AlertCircle,
} from "lucide-react";

export default function AcademicsPage() {
  const { user, school, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"scores" | "assessments" | "reportCards">("scores");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Selected filters for score entry
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("");
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Report Card State
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<ReportCard | null>(null);

  // New Assessment Dialog
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    name: "",
    type: "CA1" as "CA1" | "CA2" | "EXAM",
    maxScore: 20,
    weightPercentage: 20,
  });

  const securityCtx = {
    userId: user?.id || "usr_teacher_04",
    userSchoolId: school?.id || "sch_emerald_crest_001",
    role,
  };

  useEffect(() => {
    if (!school) return;
    const cl = db.getClasses(securityCtx);
    const sb = db.getSubjects(securityCtx);
    const asm = db.getAssessments(securityCtx);
    setClasses(cl);
    setSubjects(sb);
    setAssessments(asm);

    if (cl.length > 0 && !selectedClassId) setSelectedClassId(cl[0].id);
    if (sb.length > 0 && !selectedSubjectId) setSelectedSubjectId(sb[0].id);
    if (asm.length > 0 && !selectedAssessmentId) setSelectedAssessmentId(asm[0].id);
  }, [school]);

  useEffect(() => {
    if (!selectedClassId) return;
    const stds = db.getStudents(securityCtx, selectedClassId);
    setStudents(stds);
    if (stds.length > 0 && !selectedStudentForReport) {
      setSelectedStudentForReport(stds[0].id);
    }
  }, [selectedClassId]);

  // Load scores when assessment changes
  useEffect(() => {
    if (!selectedAssessmentId) return;
    const existingScores = db.getScores(securityCtx, selectedAssessmentId);
    const map: Record<string, number> = {};
    existingScores.forEach((s) => {
      map[s.studentId] = s.scoreObtained;
    });
    setScoreInputs(map);
    setSaveSuccessMsg("");
  }, [selectedAssessmentId]);

  const handleScoreChange = (studentId: string, value: string, maxScore: number) => {
    const numeric = Math.max(0, Math.min(maxScore, Number(value) || 0));
    setScoreInputs((prev) => ({ ...prev, [studentId]: numeric }));
    setSaveSuccessMsg("");
  };

  const handleSaveScores = () => {
    if (!selectedAssessmentId) return;
    const list = students.map((std) => ({
      assessmentId: selectedAssessmentId,
      studentId: std.id,
      scoreObtained: scoreInputs[std.id] ?? 0,
    }));
    db.recordScores(securityCtx, list);
    setSaveSuccessMsg("Scores recorded and grades computed successfully!");
    setTimeout(() => setSaveSuccessMsg(""), 3000);
  };

  const handleCreateAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentForm.name || !selectedClassId || !selectedSubjectId) return;

    const newAsm = db.addAssessment(securityCtx, {
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      termId: "trm_first_2026",
      name: assessmentForm.name,
      type: assessmentForm.type,
      maxScore: Number(assessmentForm.maxScore),
      weightPercentage: Number(assessmentForm.weightPercentage),
    });

    setAssessments(db.getAssessments(securityCtx));
    setSelectedAssessmentId(newAsm.id);
    setIsAssessmentModalOpen(false);
    setAssessmentForm({ name: "", type: "CA1", maxScore: 20, weightPercentage: 20 });
  };

  const handleGenerateReportCard = () => {
    const student = students.find((s) => s.id === selectedStudentForReport);
    if (!student) return;

    // Compile realistic term subjects results for report card
    const results = [
      compileSubjectResult("sbj_mth", "Mathematics", 36, 52), // Total 88 -> A
      compileSubjectResult("sbj_eng", "English Language", 32, 49), // Total 81 -> A
      compileSubjectResult("sbj_bsc", "Basic Science & Tech", 30, 42), // Total 72 -> B
      compileSubjectResult("sbj_eco", "Economics", 28, 40), // Total 68 -> B
      compileSubjectResult("sbj_cve", "Civic Education", 35, 50), // Total 85 -> A
    ];

    const rc = generateReportCard({
      schoolId: school?.id || "sch_emerald_crest_001",
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      classId: student.currentClassId,
      className: student.currentClassName,
      sessionId: "ses_2026_2027",
      sessionName: "2026/2027 Academic Session",
      termId: "trm_first_2026",
      termName: "First Term",
      results,
      totalStudentsInClass: students.length,
      attendanceDaysPresent: 58,
      attendanceDaysTotal: 60,
      positionInClass: 1,
    });

    setGeneratedReport(rc);
  };

  const currentAssessment = assessments.find((a) => a.id === selectedAssessmentId);
  const maxScore = currentAssessment?.maxScore || 20;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Academics & Grading
            </h1>
            <p className="text-sm text-slate-500">
              Deterministic score recording, Continuous Assessments (CA), exam marks, and official report cards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsAssessmentModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Assessment
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("scores")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "scores"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Mark Entry Register
          </button>
          <button
            onClick={() => setActiveTab("assessments")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "assessments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Configured Assessments ({assessments.length})
          </button>
          <button
            onClick={() => setActiveTab("reportCards")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
              activeTab === "reportCards"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="h-4 w-4" /> Terminal Report Cards
          </button>
        </div>

        {/* TAB 1: SCORE ENTRY SPREADSHEET */}
        {activeTab === "scores" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Target Classroom
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
                    Curriculum Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Assessment Column
                  </label>
                  <select
                    value={selectedAssessmentId}
                    onChange={(e) => setSelectedAssessmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Max: {a.maxScore})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {saveSuccessMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {saveSuccessMsg}
              </div>
            )}

            <Card className="overflow-hidden">
              <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">
                    {currentAssessment?.name || "Marksheet"} — Score Sheet
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Max Marks: {maxScore} pts • Standard WAEC Scale Enforced
                  </p>
                </div>
                <Button
                  onClick={handleSaveScores}
                  size="sm"
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" /> Save Marksheet
                </Button>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Admission No.</th>
                      <th className="px-6 py-3.5">Student Scholar</th>
                      <th className="px-6 py-3.5 text-center">Score ({maxScore})</th>
                      <th className="px-6 py-3.5 text-center">Calculated Grade</th>
                      <th className="px-6 py-3.5">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((std) => {
                      const score = scoreInputs[std.id] ?? 0;
                      // Normalize to 100 for immediate scale preview
                      const normalized = Math.round((score / maxScore) * 100);
                      const { grade, remark } = getGradeForScore(normalized);

                      return (
                        <tr key={std.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-blue-700">
                            {std.admissionNumber}
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-slate-900">
                            {std.firstName} {std.lastName}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max={maxScore}
                              value={scoreInputs[std.id] ?? ""}
                              onChange={(e) => handleScoreChange(std.id, e.target.value, maxScore)}
                              className="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-center text-sm font-bold text-slate-900 focus:outline-blue-600"
                            />
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <span
                              className={`inline-block font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                                grade === "A"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : grade === "B"
                                  ? "bg-blue-100 text-blue-800"
                                  : grade === "C"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {grade}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs font-medium text-slate-500">
                            {remark}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: ASSESSMENTS CONFIGURATION */}
        {activeTab === "assessments" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessments.map((a) => (
              <Card key={a.id} className="p-6">
                <div className="flex items-center justify-between">
                  <Badge variant="default">{a.type}</Badge>
                  <span className="text-xs font-bold text-slate-500">{a.weightPercentage}% weight</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-3">{a.name}</h3>
                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Maximum Attainable Points:</span>
                  <span className="font-bold text-slate-800">{a.maxScore} marks</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 3: TERMINAL REPORT CARDS */}
        {activeTab === "reportCards" && (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    Select Scholar:
                  </label>
                  <select
                    value={selectedStudentForReport}
                    onChange={(e) => setSelectedStudentForReport(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleGenerateReportCard} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                    <Award className="h-4 w-4" /> Generate Official Report Card
                  </Button>
                  {generatedReport && (
                    <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {generatedReport ? (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm">
                {/* School Header */}
                <div className="text-center border-b-2 border-slate-800 pb-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-700">
                    FEDERAL REPUBLIC OF NIGERIA
                  </span>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase mt-1">
                    {school?.name}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {school?.address}, {school?.city}, {school?.state}
                  </p>
                  <p className="text-xs font-semibold text-slate-800 mt-1">
                    OFFICIAL STUDENT TERMINAL PROGRESS REPORT
                  </p>
                </div>

                {/* Student Profile Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block">Student Name:</span>
                    <span className="text-sm font-bold text-slate-900">{generatedReport.studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Admission No:</span>
                    <span className="text-sm font-mono font-bold text-blue-700">
                      {generatedReport.admissionNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Class:</span>
                    <span className="text-sm font-bold text-slate-900">{generatedReport.className}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Academic Term:</span>
                    <span className="text-sm font-bold text-slate-900">
                      {generatedReport.termName} ({generatedReport.sessionName})
                    </span>
                  </div>
                </div>

                {/* Subject Results Table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300">
                      <tr>
                        <th className="p-3 border-r border-slate-300">Subject</th>
                        <th className="p-3 text-center border-r border-slate-300">C.A. (40)</th>
                        <th className="p-3 text-center border-r border-slate-300">Exam (60)</th>
                        <th className="p-3 text-center border-r border-slate-300">Total (100)</th>
                        <th className="p-3 text-center border-r border-slate-300">Grade</th>
                        <th className="p-3">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {generatedReport.results.map((r) => (
                        <tr key={r.subjectId} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-900 border-r border-slate-200">
                            {r.subjectName}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-mono">
                            {r.caScore}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-mono">
                            {r.examScore}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-mono font-bold text-slate-900">
                            {r.totalScore}
                          </td>
                          <td className="p-3 text-center border-r border-slate-200 font-bold font-mono">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                r.grade === "A"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {r.grade}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">{r.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Term Average</span>
                    <p className="text-xl font-black text-blue-700 mt-1">
                      {generatedReport.overallAverage}%
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Class Position</span>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      1st of {generatedReport.totalStudentsInClass}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Total Marks</span>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {generatedReport.totalScore} / {generatedReport.totalPossibleScore}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Attendance</span>
                    <p className="text-xl font-black text-emerald-700 mt-1">
                      {generatedReport.attendanceDaysPresent} / {generatedReport.attendanceDaysTotal} days
                    </p>
                  </div>
                </div>

                {/* Remarks */}
                <div className="mt-6 space-y-3 text-xs">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <span className="font-bold text-slate-800">Form Teacher&apos;s Remarks: </span>
                    <span className="text-slate-600">{generatedReport.teacherRemarks}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <span className="font-bold text-slate-800">Principal / Proprietor&apos;s Remarks: </span>
                    <span className="text-slate-600">{generatedReport.principalRemarks}</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Award}
                title="No report card generated"
                description="Select a student and click 'Generate Official Report Card' to compute term results."
                actionLabel="Generate Report Card"
                onAction={handleGenerateReportCard}
              />
            )}
          </div>
        )}

        {/* Modal: New Assessment */}
        <Dialog
          isOpen={isAssessmentModalOpen}
          onClose={() => setIsAssessmentModalOpen(false)}
          title="Create New Continuous Assessment"
          description="Configure assessment weights and max scores."
        >
          <form onSubmit={handleCreateAssessment} className="space-y-4">
            <Input
              label="Assessment Name"
              placeholder="e.g. 2nd Continuous Assessment (CA2)"
              required
              value={assessmentForm.name}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, name: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="w-full space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Type</label>
                <select
                  value={assessmentForm.type}
                  onChange={(e) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      type: e.target.value as "CA1" | "CA2" | "EXAM",
                    })
                  }
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="CA1">CA1</option>
                  <option value="CA2">CA2</option>
                  <option value="EXAM">Exam</option>
                </select>
              </div>
              <Input
                label="Max Score"
                type="number"
                value={assessmentForm.maxScore}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, maxScore: Number(e.target.value) })
                }
              />
              <Input
                label="Weight (%)"
                type="number"
                value={assessmentForm.weightPercentage}
                onChange={(e) =>
                  setAssessmentForm({ ...assessmentForm, weightPercentage: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsAssessmentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Assessment</Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}
