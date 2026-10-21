import { z } from "zod";
import { BadRequestError } from "../../shared/http/errors";

export type PeopleKind = "student" | "teacher";
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,49}$/),
  label: z.string().trim().min(1).max(100),
  type: z.enum(["text", "email", "date", "number", "select"]),
  required: z.boolean(),
  enabled: z.boolean(),
  aliases: z.array(z.string().trim().min(1).max(100)).max(15),
  options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
});
export type PeopleField = z.infer<typeof fieldSchema>;
export const fieldsSchema = z.array(fieldSchema).max(80);
const field = (key: string, label: string, type: PeopleField["type"] = "text", required = false, aliases: string[] = [], options: string[] = []): PeopleField =>
  ({ key, label, type, required, enabled: true, aliases, options });

export const defaults: Record<PeopleKind, PeopleField[]> = {
  student: [
    field("firstName", "First name", "text", true), field("lastName", "Last name", "text", true, ["Surname"]),
    field("gender", "Gender", "select", true, ["Sex"], ["male", "female"]),
    field("classId", "Class", "select", true, ["Class name"]), field("armId", "Arm", "select"),
    field("admissionNumber", "Admission number"), field("middleName", "Middle name"), field("dateOfBirth", "Date of birth", "date", false, ["DOB"]),
    field("address", "Address"), field("bloodGroup", "Blood group"), field("genotype", "Genotype"),
    field("guardianFirstName", "Guardian first name"), field("guardianLastName", "Guardian last name"),
    field("guardianPhone", "Guardian phone"), field("guardianEmail", "Guardian email", "email"),
    field("guardianRelationship", "Guardian relationship", "select", false, [], ["father", "mother", "guardian", "other"]),
  ],
  teacher: [
    field("firstName", "First name", "text", true), field("lastName", "Last name", "text", true, ["Surname"]),
    field("email", "E-mail (used to sign in)", "email", true, ["Email", "Email address"]), field("phone", "Phone"),
    field("employeeId", "Employee ID"), field("title", "Job title"), field("gender", "Gender", "select", false, ["Sex"], ["male", "female", "other"]),
    field("address", "Address"), field("dateOfBirth", "Date of birth", "date", false, ["DOB"]), field("joinDate", "Join date", "date"),
    field("department", "Department"), field("qualification", "Qualification"), field("yearsOfExperience", "Years of experience", "number"),
  ],
};

export const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_\-.\/()]+/g, "");
const reserved = new Set(["constructor", "prototype", "__proto__", "role", "password", "schoolId", "userId", "id", "customFields", "createLogin", "guardian", "enrollmentStatus", "enrolledDate", "classTeacherArmId", "classTeacherClassId"]);

/** Merge overrides with the system fields. Essential account/class fields cannot be hidden. */
export function resolveFields(kind: PeopleKind, overrides: PeopleField[] = []): PeopleField[] {
  const seen = new Set<string>();
  for (const f of overrides) {
    if (seen.has(f.key) || reserved.has(f.key)) throw new BadRequestError(`Duplicate or reserved field key: ${f.key}`);
    seen.add(f.key);
    const core = defaults[kind].find((c) => c.key === f.key);
    if (!core && Object.values(defaults).flat().some((c) => c.key === f.key)) throw new BadRequestError(`Field ${f.key} belongs to the other form.`);
    if (core && (f.type !== core.type || JSON.stringify(f.options) !== JSON.stringify(core.options) || (core.required && (!f.required || !f.enabled)))) throw new BadRequestError(`${core.label} must keep its type, choices, and essential requirements.`);
    if (f.required && !f.enabled) throw new BadRequestError(`${f.label} cannot be required and hidden.`);
    if (!core && f.type === "select" && (!f.options.length || new Set(f.options.map(normalizeHeader)).size !== f.options.length)) throw new BadRequestError(`${f.label} needs unique choices.`);
  }
  const fields = defaults[kind].map((f) => overrides.find((v) => v.key === f.key) ?? f)
    .concat(overrides.filter((f) => !defaults[kind].some((v) => v.key === f.key)));
  const headers = new Map<string, string>();
  if (fields.length > 80) throw new BadRequestError("Use at most 80 fields per form.");
  for (const f of fields.filter((v) => v.enabled)) {
    for (const header of [f.key, f.label, ...f.aliases]) {
      const normalized = normalizeHeader(header);
      if (!normalized) throw new BadRequestError(`Invalid CSV heading for ${f.label}.`);
      const previous = headers.get(normalized);
      if (previous && previous !== f.key) throw new BadRequestError(`CSV heading "${header}" matches more than one field.`);
      headers.set(normalized, f.key);
    }
  }
  return fields;
}

export function validatePeopleFields(kind: PeopleKind, fields: PeopleField[], input: Record<string, unknown>): void {
  const custom = (input.customFields ?? {}) as Record<string, unknown>;
  const coreKeys = new Set(defaults[kind].map((f) => f.key));
  for (const key of Object.keys(custom)) {
    if (!fields.some((f) => f.key === key && f.enabled && !coreKeys.has(key))) throw new BadRequestError(`Unknown custom field: ${key}`);
  }
  const guardian = input.guardian as Record<string, unknown> | undefined;
  for (const f of fields.filter((v) => v.enabled)) {
    const value = f.key.startsWith("guardian") && coreKeys.has(f.key)
      ? guardian?.[f.key.slice(8, 9).toLowerCase() + f.key.slice(9)]
      : coreKeys.has(f.key) ? input[f.key] : custom[f.key];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      if (f.required) throw new BadRequestError(`${f.label} is required.`);
      continue;
    }
    if (f.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new BadRequestError(`${f.label} must be a number.`);
    } else {
      if (typeof value !== "string" || value.length > 2000) throw new BadRequestError(`${f.label} must be text (up to 2000 characters).`);
      if (f.type === "email" && !z.email().safeParse(value).success) throw new BadRequestError(`${f.label} must be a valid email.`);
      if (f.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new BadRequestError(`${f.label} must be a valid YYYY-MM-DD date.`);
      if (f.type === "select" && f.options.length && !f.options.includes(value)) throw new BadRequestError(`${f.label} must be one of: ${f.options.join(", ")}.`);
    }
  }
}
