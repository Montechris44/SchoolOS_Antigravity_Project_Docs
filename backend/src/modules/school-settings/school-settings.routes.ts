import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { BadRequestError } from "../../shared/http/errors";
import { ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { schoolFolder, uploadToStorage } from "../../shared/storage/cloudinary";
import { validateBody } from "../../shared/validation/validate";
import { ADMIN_ROLES } from "../../config/rbac";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");

const updateSchema = z.object({
  passMark: z.number().min(0).max(100).optional(),
  rankingMode: z.enum(["AUTO", "AVERAGE", "SSS_GRADE_COUNTS"]).optional(),
  allowParentPortal: z.boolean().optional(),
  allowStudentPortal: z.boolean().optional(),
  staffSignInCutoff: time.optional(),
  staffVeryLateCutoff: time.optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2563eb").nullish(),
  studentEmailDomain: z
    .string()
    .toLowerCase()
    .regex(/^(?=.{4,120}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "Enter a domain like myschool.edu.ng")
    .nullish(),
  schoolCode: z
    .string()
    .regex(/^[A-Za-z0-9]{2,12}$/, "2–12 letters or digits")
    .nullish(),
});

const SETTINGS_SELECT = `
  SELECT ss.pass_mark, ss.max_score, ss.ranking_mode, ss.allow_parent_portal, ss.allow_student_portal, ss.timezone,
         ss.staff_sign_in_cutoff, ss.staff_very_late_cutoff,
         s.id AS school_id, s.name AS school_name, s.slug, s.logo_url, s.theme_color, s.school_code, s.student_email_domain
  FROM schools s LEFT JOIN school_settings ss ON ss.school_id = s.id
  WHERE s.id = $1`;

async function loadSettings(schoolId: string) {
  await query("INSERT INTO school_settings (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING", [schoolId]);
  const result = await query(SETTINGS_SELECT, [schoolId]);
  return result.rows[0];
}

async function getHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  reply.status(200).send(ok(toCamelCase(await loadSettings(actor.schoolId))));
}

async function updateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requireRole(actor, ADMIN_ROLES);

  const input = validateBody(request, updateSchema);
  if (input.staffSignInCutoff && input.staffVeryLateCutoff && input.staffVeryLateCutoff <= input.staffSignInCutoff) {
    throw new BadRequestError("The very-late cutoff must be after the sign-in cutoff.");
  }

  await loadSettings(actor.schoolId);
  await query(
    `UPDATE school_settings SET
       pass_mark = COALESCE($2, pass_mark),
       ranking_mode = COALESCE($3, ranking_mode),
       allow_parent_portal = COALESCE($4, allow_parent_portal),
       allow_student_portal = COALESCE($5, allow_student_portal),
       staff_sign_in_cutoff = COALESCE($6::time, staff_sign_in_cutoff),
       staff_very_late_cutoff = COALESCE($7::time, staff_very_late_cutoff)
     WHERE school_id = $1`,
    [
      actor.schoolId,
      input.passMark ?? null,
      input.rankingMode ?? null,
      input.allowParentPortal ?? null,
      input.allowStudentPortal ?? null,
      input.staffSignInCutoff ?? null,
      input.staffVeryLateCutoff ?? null,
    ]
  );

  if (input.themeColor !== undefined || input.studentEmailDomain !== undefined || input.schoolCode !== undefined) {
    await query(
      `UPDATE schools SET
         theme_color = CASE WHEN $2::boolean THEN $3 ELSE theme_color END,
         student_email_domain = CASE WHEN $4::boolean THEN $5 ELSE student_email_domain END,
         school_code = CASE WHEN $6::boolean THEN UPPER($7) ELSE school_code END
       WHERE id = $1`,
      [
        actor.schoolId,
        input.themeColor !== undefined,
        input.themeColor ?? null,
        input.studentEmailDomain !== undefined,
        input.studentEmailDomain ?? null,
        input.schoolCode !== undefined,
        input.schoolCode ?? null,
      ]
    );
  }

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "school.settings_updated",
    resourceType: "school_settings",
    payload: input,
  });
  reply.status(200).send(ok(toCamelCase(await loadSettings(actor.schoolId))));
}

async function logoHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  requirePermission(actor, "school:manage");

  const file = await request.file();
  if (!file) throw new BadRequestError("Attach an image in the 'file' field.");
  const buffer = await file.toBuffer();

  const uploaded = await uploadToStorage(buffer, schoolFolder(actor.schoolId, "branding"), "image");
  await query("UPDATE schools SET logo_url = $2 WHERE id = $1", [actor.schoolId, uploaded.url]);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "school.logo_updated",
    resourceType: "school",
    resourceId: actor.schoolId,
  });
  reply.status(200).send(ok({ logoUrl: uploaded.url }));
}

export async function schoolSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/school-settings", { preHandler: authenticate }, getHandler);
  app.patch("/school-settings", { preHandler: authenticate }, updateHandler);
  app.post("/school-settings/logo", { preHandler: authenticate }, logoHandler);
}
