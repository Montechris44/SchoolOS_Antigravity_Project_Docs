export function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

/** Detects Senior Secondary classes ("SS 2", "SSS3 Gold", "Senior Secondary 1") for grade-count ranking. */
export function isSeniorSecondaryClass(className: string): boolean {
  const n = (className || "").toUpperCase().replace(/\s+/g, "");
  return /^(SSS|SS)[1-3]/.test(n) || n.includes("SENIORSECONDARY");
}

/** Login e-mail for a student: firstname.lastname@domain (letters/digits only). */
export function buildStudentEmail(firstName: string, lastName: string, domain: string): string {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean(firstName)}.${clean(lastName)}@${domain.toLowerCase().replace(/^@/, "").trim()}`;
}
