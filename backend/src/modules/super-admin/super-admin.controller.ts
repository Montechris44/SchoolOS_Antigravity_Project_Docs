import { FastifyReply, FastifyRequest } from "fastify";

import { getSuperAdminContext } from "../../middleware/super-admin-auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import {
  getPlatformAnalytics,
  getSchoolDetail,
  getSuperAdminById,
  listAuditLogs,
  listSchools,
  listUsersAcrossSchools,
  superAdminLogin,
  unlockProfile,
  updateSchoolStatus,
} from "./super-admin.service";
import {
  listAuditLogsQuerySchema,
  listSchoolsQuerySchema,
  listUsersQuerySchema,
  profileIdParamsSchema,
  schoolIdParamsSchema,
  superAdminLoginSchema,
  updateSchoolStatusSchema,
} from "./super-admin.schemas";

export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = validateBody(request, superAdminLoginSchema);
  const admin = await superAdminLogin(input);

  const token = await reply.jwtSign({ sub: admin.id, scope: "super_admin" as const });

  reply.status(200).send(ok({ superAdmin: toCamelCase(admin), token }));
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getSuperAdminContext(request);
  const admin = await getSuperAdminById(actor.superAdminId);
  reply.status(200).send(ok(toCamelCase(admin)));
}

export async function listSchoolsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  getSuperAdminContext(request);
  const filters = validateQuery(request, listSchoolsQuerySchema);
  const schools = await listSchools(filters);
  reply.status(200).send(ok(toCamelCase(schools)));
}

export async function getSchoolHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  getSuperAdminContext(request);
  const { schoolId } = validateParams(request, schoolIdParamsSchema);
  const school = await getSchoolDetail(schoolId);
  reply.status(200).send(ok(toCamelCase(school)));
}

export async function updateSchoolStatusHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getSuperAdminContext(request);
  const { schoolId } = validateParams(request, schoolIdParamsSchema);
  const input = validateBody(request, updateSchoolStatusSchema);
  const school = await updateSchoolStatus(schoolId, actor.superAdminId, input);
  reply.status(200).send(ok(toCamelCase(school)));
}

export async function listUsersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  getSuperAdminContext(request);
  const { schoolId } = validateQuery(request, listUsersQuerySchema);
  const users = await listUsersAcrossSchools(schoolId);
  reply.status(200).send(ok(toCamelCase(users)));
}

export async function unlockProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getSuperAdminContext(request);
  const { profileId } = validateParams(request, profileIdParamsSchema);
  await unlockProfile(actor.superAdminId, profileId);
  reply.status(200).send(ok({ profileId, unlocked: true }));
}

export async function getAnalyticsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  getSuperAdminContext(request);
  const analytics = await getPlatformAnalytics();
  reply.status(200).send(ok(toCamelCase(analytics)));
}

export async function listAuditLogsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  getSuperAdminContext(request);
  const filters = validateQuery(request, listAuditLogsQuerySchema);
  const logs = await listAuditLogs(filters);
  reply.status(200).send(ok(toCamelCase(logs)));
}
