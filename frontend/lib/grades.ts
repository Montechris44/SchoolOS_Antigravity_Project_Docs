import { GradeBand } from "@/types/portal";

/** Same lookup the server uses: the band containing the score, highest minimum first. */
export function gradeFor(score: number | null, bands: GradeBand[]): { grade: string; remark: string | null; isPass: boolean } | null {
  if (score === null || Number.isNaN(score)) return null;
  const band = [...bands].sort((a, b) => b.minScore - a.minScore).find((b) => score >= b.minScore && score <= b.maxScore);
  return band ? { grade: band.grade, remark: band.remark, isPass: band.isPass } : null;
}

export function gradeColor(grade: string | null | undefined): string {
  if (!grade || grade === "N/A") return "text-slate-400";
  const letter = grade[0].toUpperCase();
  if (letter === "A") return "text-emerald-600";
  if (letter === "B") return "text-sky-600";
  if (letter === "C") return "text-amber-600";
  if (letter === "D" || letter === "E") return "text-orange-600";
  return "text-rose-600";
}
