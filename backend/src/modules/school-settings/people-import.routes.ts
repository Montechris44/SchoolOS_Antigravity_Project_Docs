import { createHash } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../../db/pool";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { BadRequestError } from "../../shared/http/errors";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission } from "../../shared/security/tenant-guard";
import { createStudentSchema } from "../students/students.schemas";
import { createStudent } from "../students/students.service";
import { createStaffSchema } from "../staff/staff.schemas";
import { createStaff } from "../staff/staff.service";
import { defaults, normalizeHeader, PeopleKind, validatePeopleFields } from "./people-fields";
import { loadPeopleFields } from "./people-fields.service";

/** RFC-style CSV reader: quoted commas/newlines, escaped quotes, BOM and CRLF. */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  const pushCell = () => { row.push(cell.trim()); cell = ""; closed = false; };
  const pushRow = () => { pushCell(); if (row.some(Boolean)) rows.push(row); row = []; };
  csv = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ",") pushCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && csv[i + 1] === "\n") i++; pushRow(); }
    else if (char === '"' && !cell.trim() && !closed) { cell = ""; quoted = true; }
    else if (char === '"' || (closed && char.trim())) throw new BadRequestError("Malformed CSV quoting.");
    else cell += char;
  }
  if (quoted) throw new BadRequestError("The CSV contains an unclosed quoted cell.");
  pushRow();
  if (rows.length < 2) throw new BadRequestError("Include a header row and at least one record.");
  if (rows.length > 301) throw new BadRequestError("Import at most 300 records at a time.");
  return rows;
}

export async function previewPeopleImport(schoolId: string, kind: PeopleKind, csv: string) {
  const fields = await loadPeopleFields(schoolId, kind);
  const table = parseCsv(csv);
  const headers = table[0];
  const errors: string[] = [];
  const mapped = headers.map((h) => fields.find((f) => f.enabled && [f.key, f.label, ...f.aliases].some((a) => normalizeHeader(a) === normalizeHeader(h))));
  const targets = new Set<string>();
  mapped.forEach((f, index) => {
    if (!f) errors.push(`Unmapped column "${headers[index]}". Add it or its CSV alias in school settings.`);
    else if (targets.has(f.key)) errors.push(`More than one column maps to ${f.label}.`);
    else targets.add(f.key);
  });
  fields.filter((f) => f.enabled && f.required && !targets.has(f.key)).forEach((f) => errors.push(`Missing column: ${f.label}.`));
  const classes = kind === "student" ? (await query("SELECT id, name FROM classes WHERE school_id = $1", [schoolId])).rows : [];
  const arms = kind === "student" ? (await query("SELECT id, name, class_id FROM class_arms WHERE school_id = $1", [schoolId])).rows : [];
  const core = new Set(defaults[kind].map((f) => f.key));
  const seenIdentifiers = new Set<string>();
  const rows = table.slice(1).map((cells, index) => {
    const rowErrors: string[] = [];
    const data: Record<string, any> = kind === "teacher" ? { role: "teacher" } : {};
    const custom: Record<string, string | number> = {};
    const guardian: Record<string, string> = {};
    const displayValues: Record<string, string> = {};
    if (cells.length !== headers.length) rowErrors.push(`Expected ${headers.length} cells, found ${cells.length}.`);
    mapped.forEach((f, column) => {
      if (!f || !cells[column]) return;
      let value: string | number = cells[column];
      if (f.type === "number") value = Number(value);
      if (f.type === "select" && f.options.length) {
        const text = String(value).toLowerCase();
        value = f.key === "gender" && ["m", "f"].includes(text) ? (text === "m" ? "male" : "female") : f.options.find((o) => o.toLowerCase() === text) ?? value;
      }
      if (!core.has(f.key)) custom[f.key] = value;
      else if (f.key.startsWith("guardian")) guardian[f.key.slice(8, 9).toLowerCase() + f.key.slice(9)] = String(value);
      else data[f.key] = value;
    });
    data.customFields = custom;
    if (Object.keys(guardian).length) data.guardian = { relationship: "guardian", ...guardian };
    if (kind === "student") {
      const cls = classes.filter((c) => c.id === data.classId || c.name.trim().toLowerCase() === String(data.classId ?? "").toLowerCase());
      if (cls.length !== 1) rowErrors.push(`Unknown or ambiguous class "${data.classId ?? ""}".`);
      else {
        data.classId = cls[0].id;
        displayValues.classId = cls[0].name;
        if (data.armId) {
          const arm = arms.filter((a) => a.class_id === data.classId && (a.id === data.armId || a.name.trim().toLowerCase() === String(data.armId).toLowerCase()));
          if (arm.length !== 1) rowErrors.push(`Unknown or ambiguous arm "${data.armId}" in ${cls[0].name}.`);
          else { data.armId = arm[0].id; displayValues.armId = arm[0].name; }
        }
      }
    }
    const schema = kind === "student" ? createStudentSchema : createStaffSchema;
    const parsed = schema.safeParse(data);
    if (!parsed.success) rowErrors.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    try { validatePeopleFields(kind, fields, data); } catch (err) { rowErrors.push((err as Error).message); }
    for (const key of kind === "teacher" ? ["email", "employeeId"] : ["admissionNumber"]) {
      if (!data[key]) continue;
      const identity = `${key}:${String(data[key]).toLowerCase()}`;
      if (seenIdentifiers.has(identity)) rowErrors.push(`Duplicate ${key} in this file.`);
      seenIdentifiers.add(identity);
    }
    return { index, data: parsed.success ? parsed.data : data, displayValues, errors: [...new Set(rowErrors)] };
  });
  // Binds confirmation to this school's exact mapping and the validated data.
  const previewToken = createHash("sha256").update(JSON.stringify({ schoolId, kind, csv, fields, rows })).digest("hex");
  return { fields, headers, mappings: mapped.map((f) => f?.label ?? null), errors, rows, previewToken };
}

export async function peopleImportRoutes(app: FastifyInstance, kind: PeopleKind) {
  const path = kind === "student" ? "/students" : "/staff";
  const schema = z.object({ csv: z.string().min(1).max(1_000_000), previewToken: z.string().optional() });
  for (const preview of [true, false]) {
    app.post(`${path}/import${preview ? "/preview" : ""}`, { preHandler: authenticate }, async (request, reply) => {
      const actor = getAuthContext(request);
      requirePermission(actor, kind === "student" ? "students:manage" : "staff:manage");
      const input = schema.parse(request.body);
      const result = await previewPeopleImport(actor.schoolId, kind, input.csv);
      if (preview) return reply.send(ok(result));
      if (result.errors.length || result.rows.some((r) => r.errors.length)) throw new BadRequestError("Fix the CSV validation errors before saving.");
      if (input.previewToken !== result.previewToken) throw new BadRequestError("The import or school fields changed. Preview the file again before saving.");
      const success: unknown[] = [], failed: Array<{ index: number; error: string }> = [];
      for (const row of result.rows) {
        try {
          if (kind === "student") {
            const created = await createStudent(actor.schoolId, actor.userId, createStudentSchema.parse(row.data));
            success.push({ index: row.index, record: toCamelCase(created.student), credentials: created.credentials });
          } else {
            const parsed = createStaffSchema.parse(row.data);
            const created = await createStaff(actor.schoolId, actor.userId, parsed);
            success.push({ index: row.index, record: toCamelCase(created), credentials: created.temporary_password ? { email: parsed.email, temporaryPassword: created.temporary_password } : null });
          }
        } catch (err) { failed.push({ index: row.index, error: (err as Error).message }); }
      }
      return reply.status(201).send(ok({ success, failed }));
    });
  }
}
