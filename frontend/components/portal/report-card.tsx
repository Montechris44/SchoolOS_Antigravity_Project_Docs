"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gradeColor } from "@/lib/grades";
import { formatDate } from "@/lib/utils";
import { ReportCardData } from "@/types/portal";

/** A printable term report card. The browser's "Save as PDF" turns it into a PDF. */
export function ReportCard({ card }: { card: ReportCardData }) {
  const componentNames = Array.from(new Set(card.subjects.flatMap((s) => Object.keys(s.caComponents ?? {}))));

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / save as PDF
        </Button>
      </div>

      <div className="print-area rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <header className="flex items-center gap-4 border-b-2 border-brand pb-5">
          {card.school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.school.logoUrl} alt="" className="h-16 w-16 rounded-xl object-contain" />
          )}
          <div className="min-w-0 flex-1 text-center">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-slate-900">{card.school.name}</h2>
            <p className="text-xs text-slate-500">{[card.school.address, card.school.city, card.school.state].filter(Boolean).join(", ")}</p>
            <p className="text-xs text-slate-500">{[card.school.phone, card.school.email].filter(Boolean).join(" · ")}</p>
          </div>
          {card.student.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.student.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
          )}
        </header>

        <h3 className="mt-4 text-center font-heading text-lg font-bold uppercase text-brand">
          {card.termName} report card · {card.sessionName}
        </h3>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
          <div><dt className="text-[10px] font-bold uppercase text-slate-400">Name</dt><dd className="font-semibold">{card.student.firstName} {card.student.middleName ?? ""} {card.student.lastName}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase text-slate-400">Admission no.</dt><dd className="font-mono font-semibold">{card.student.admissionNumber}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase text-slate-400">Class</dt><dd className="font-semibold">{card.className}{card.armName ? ` ${card.armName}` : ""}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase text-slate-400">Position</dt><dd className="font-semibold">{card.positionSuffix ?? card.position ?? "—"} of {card.classSize ?? "—"}</dd></div>
        </dl>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="border border-slate-200 px-3 py-2 text-left">Subject</th>
                {componentNames.map((name) => <th key={name} className="border border-slate-200 px-2 py-2 text-center">{name.toUpperCase()}</th>)}
                <th className="border border-slate-200 px-2 py-2 text-center">Exam</th>
                <th className="border border-slate-200 px-2 py-2 text-center">Total</th>
                <th className="border border-slate-200 px-2 py-2 text-center">Grade</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Remark</th>
              </tr>
            </thead>
            <tbody>
              {card.subjects.map((subject) => (
                <tr key={subject.subjectName}>
                  <td className="border border-slate-200 px-3 py-1.5 font-semibold">{subject.subjectName}</td>
                  {componentNames.map((name) => <td key={name} className="border border-slate-200 px-2 py-1.5 text-center">{subject.caComponents?.[name] ?? "—"}</td>)}
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{subject.examScore ?? "—"}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">{subject.totalScore}</td>
                  <td className={`border border-slate-200 px-2 py-1.5 text-center font-bold ${gradeColor(subject.grade)}`}>{subject.grade}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-xs text-slate-600">{subject.subjectRemark || subject.gradeRemark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Total score", card.totalScore ?? "—"],
            ["Average", card.averageScore != null ? Number(card.averageScore).toFixed(1) : "—"],
            ["Subjects passed", `${card.passedSubjects} / ${card.totalSubjects}`],
            ["Subjects failed", card.failedSubjects],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="font-heading text-xl font-bold text-slate-900">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <p><span className="font-bold text-slate-700">Class teacher&apos;s remark: </span><span className="text-slate-600">{card.teacherRemark || "—"}</span></p>
          <p><span className="font-bold text-slate-700">Principal&apos;s remark: </span><span className="text-slate-600">{card.principalRemark || "—"}</span></p>
          {card.nextTermBegins && <p><span className="font-bold text-slate-700">Next term begins: </span><span className="text-slate-600">{formatDate(card.nextTermBegins)}</span></p>}
        </div>

        <p className="mt-5 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
          Grading: {card.gradingScale.map((b) => `${b.grade} ${b.minScore}–${b.maxScore}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}
