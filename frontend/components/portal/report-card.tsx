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

      <div className="print-area rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card md:p-10 ring-1 ring-slate-900/5">
        <header className="flex items-center gap-4 border-b-2 border-brand pb-6">
          {card.school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.school.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain ring-2 ring-slate-100 shadow-2xs" />
          )}
          <div className="min-w-0 flex-1 text-center">
            <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-slate-900">{card.school.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{[card.school.address, card.school.city, card.school.state].filter(Boolean).join(", ")}</p>
            <p className="text-xs text-slate-500">{[card.school.phone, card.school.email].filter(Boolean).join(" · ")}</p>
          </div>
          {card.student.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.student.photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-slate-100 shadow-2xs" />
          )}
        </header>

        <div className="mt-4 text-center">
          <span className="inline-block rounded-full bg-brand-soft px-4 py-1 font-heading text-sm font-bold uppercase tracking-wider text-brand">
            {card.termName} Report Card · {card.sessionName}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm md:grid-cols-4">
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Name</dt><dd className="font-bold text-slate-900 mt-0.5">{card.student.firstName} {card.student.middleName ?? ""} {card.student.lastName}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admission No.</dt><dd className="font-mono font-bold text-slate-900 mt-0.5">{card.student.admissionNumber}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Class & Arm</dt><dd className="font-bold text-slate-900 mt-0.5">{card.className}{card.armName ? ` ${card.armName}` : ""}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terminal Position</dt><dd className="font-bold text-brand mt-0.5">{card.positionSuffix ?? card.position ?? "—"} of {card.classSize ?? "—"}</dd></div>
        </dl>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                <th className="px-3.5 py-2.5 text-left">Subject</th>
                {componentNames.map((name) => <th key={name} className="px-2 py-2.5 text-center">{name.toUpperCase()}</th>)}
                <th className="px-2 py-2.5 text-center">Exam</th>
                <th className="px-2 py-2.5 text-center">Total</th>
                <th className="px-2 py-2.5 text-center">Grade</th>
                <th className="px-3.5 py-2.5 text-left">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {card.subjects.map((subject, idx) => (
                <tr key={subject.subjectName} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                  <td className="px-3.5 py-2 font-semibold text-slate-900">{subject.subjectName}</td>
                  {componentNames.map((name) => <td key={name} className="px-2 py-2 text-center text-slate-600">{subject.caComponents?.[name] ?? "—"}</td>)}
                  <td className="px-2 py-2 text-center text-slate-600">{subject.examScore ?? "—"}</td>
                  <td className="px-2 py-2 text-center font-bold text-slate-900">{subject.totalScore}</td>
                  <td className={`px-2 py-2 text-center font-black ${gradeColor(subject.grade)}`}>{subject.grade}</td>
                  <td className="px-3.5 py-2 text-xs text-slate-600">{subject.subjectRemark || subject.gradeRemark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Total score", card.totalScore ?? "—"],
            ["Terminal average", card.averageScore != null ? Number(card.averageScore).toFixed(1) : "—"],
            ["Subjects passed", `${card.passedSubjects} / ${card.totalSubjects}`],
            ["Subjects failed", card.failedSubjects],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-center shadow-2xs">
              <p className="font-heading text-2xl font-black text-slate-900">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2.5 text-sm rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <p><span className="font-bold text-slate-800">Class teacher&apos;s remark: </span><span className="text-slate-600">{card.teacherRemark || "—"}</span></p>
          <p><span className="font-bold text-slate-800">Principal&apos;s remark: </span><span className="text-slate-600">{card.principalRemark || "—"}</span></p>
          {card.nextTermBegins && <p><span className="font-bold text-slate-800">Next term begins: </span><span className="text-brand font-semibold">{formatDate(card.nextTermBegins)}</span></p>}
        </div>

        <p className="mt-5 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
          Grading: {card.gradingScale.map((b) => `${b.grade} ${b.minScore}–${b.maxScore}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}
