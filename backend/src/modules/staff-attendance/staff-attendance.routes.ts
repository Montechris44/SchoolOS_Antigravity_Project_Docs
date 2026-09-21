import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate, getAuthContext } from "../../middleware/auth";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import {
  clockIn,
  clockOut,
  closeSession,
  getByDate,
  getMyMonth,
  getMyStatus,
  getSession,
  getStaffHistory,
  markStaffAttendance,
  openSession,
} from "./staff-attendance.service";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");
const STAFF_SELF_ROLES = ["admin", "teacher", "bursar", "non_academic"] as const;

const dateQuery = z.object({ date: date.optional() });
const sessionBody = z.object({ date: date.optional() });
const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(120).default(30) });
const monthQuery = z.object({ month: z.string().optional() });
const staffParams = z.object({ staffId: z.string().uuid() });
const markBody = z.object({
  staffUserId: z.string().uuid(),
  attendanceDate: date,
  status: z.enum(["ON_TIME", "LATE", "VERY_LATE", "ABSENT", "ON_LEAVE"]),
  signInTime: time.nullish(),
  signOutTime: time.nullish(),
  notes: z.string().max(300).nullish(),
});

const guard = { preHandler: authenticate };

function manager(request: FastifyRequest) {
  const actor = getAuthContext(request);
  requirePermission(actor, "staff_attendance:manage");
  return actor;
}

function staffMember(request: FastifyRequest) {
  const actor = getAuthContext(request);
  requireRole(actor, [...STAFF_SELF_ROLES]);
  return actor;
}

export async function staffAttendanceRoutes(app: FastifyInstance): Promise<void> {
  // Administrator: the day's register and the gate that lets staff sign in.
  app.get("/staff-attendance", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const { date: day } = validateQuery(request, dateQuery);
    reply.send(ok(toCamelCase(await getByDate(actor.schoolId, day ?? new Date().toISOString().slice(0, 10)))));
  });

  app.get("/staff-attendance/session", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const { date: day } = validateQuery(request, dateQuery);
    reply.send(ok(toCamelCase(await getSession(actor.schoolId, day ?? new Date().toISOString().slice(0, 10)))));
  });

  app.post("/staff-attendance/session/open", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const { date: day } = validateBody(request, sessionBody);
    reply.send(ok(toCamelCase(await openSession(actor.schoolId, actor.userId, day))));
  });

  app.post("/staff-attendance/session/close", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const { date: day } = validateBody(request, sessionBody);
    reply.send(ok(toCamelCase(await closeSession(actor.schoolId, actor.userId, day))));
  });

  app.get("/staff-attendance/history/:staffId", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const { staffId } = validateParams(request, staffParams);
    const { limit } = validateQuery(request, historyQuery);
    reply.send(ok(toCamelCase(await getStaffHistory(actor.schoolId, staffId, limit))));
  });

  app.post("/staff-attendance/mark", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = manager(request);
    const input = validateBody(request, markBody);
    reply.send(ok(toCamelCase(await markStaffAttendance(actor.schoolId, actor.userId, input))));
  });

  // Every staff member: sign in and out while the administrator has attendance open.
  app.get("/staff-attendance/me", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = staffMember(request);
    const { date: day } = validateQuery(request, dateQuery);
    reply.send(ok(toCamelCase(await getMyStatus(actor.schoolId, actor.userId, day))));
  });

  app.get("/staff-attendance/me/history", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = staffMember(request);
    const { month } = validateQuery(request, monthQuery);
    const current = new Date().toISOString().slice(0, 7);
    reply.send(ok(toCamelCase(await getMyMonth(actor.schoolId, actor.userId, month ?? current))));
  });

  app.post("/staff-attendance/clock-in", { ...guard, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = staffMember(request);
    reply.send(ok(toCamelCase(await clockIn(actor.schoolId, actor.userId))));
  });

  app.post("/staff-attendance/clock-out", { ...guard, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = staffMember(request);
    reply.send(ok(toCamelCase(await clockOut(actor.schoolId, actor.userId))));
  });
}
