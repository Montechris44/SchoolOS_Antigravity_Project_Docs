import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { isAdminRole } from "../../config/rbac";
import { authenticate, getAuthContext } from "../../middleware/auth";
import { query } from "../../db/pool";
import { toCamelCase } from "../../shared/http/case";
import { ForbiddenError } from "../../shared/http/errors";
import { created, ok } from "../../shared/http/reply";
import { requirePermission, requireRole } from "../../shared/security/tenant-guard";
import { validateBody, validateParams, validateQuery } from "../../shared/validation/validate";
import { getStudentById } from "../students/students.service";
import {
  copyEntries,
  createEntry,
  deleteEntry,
  getStudentNextClass,
  getStudentTimetable,
  getStudentToday,
  getTeacherTimetable,
  groupByDay,
  importEntries,
  listEntries,
  updateEntry,
} from "./timetable.service";

const uuid = z.string().uuid();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");

const entryFields = z.object({
  classId: uuid,
  armId: uuid.nullish(),
  termId: uuid.nullish(),
  subjectId: uuid.nullish(),
  teacherId: uuid.nullish(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: time,
  endTime: time,
  room: z.string().trim().max(50).nullish(),
});
const entrySchema = entryFields.refine((data) => data.startTime < data.endTime, { message: "The start time must be before the end time.", path: ["endTime"] });
const patchSchema = entryFields.partial().refine((data) => Object.keys(data).length > 0, "Nothing to update");
const importSchema = z.object({ entries: z.array(entrySchema).min(1).max(300) });
const copySchema = z.object({
  fromClassId: uuid,
  toClassId: uuid,
  fromArmId: uuid.nullish(),
  toArmId: uuid.nullish(),
  fromTermId: uuid.optional(),
  toTermId: uuid.optional(),
});
const listSchema = z.object({
  classId: uuid.optional(),
  armId: uuid.optional(),
  teacherId: uuid.optional(),
  termId: uuid.optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
});
const idSchema = z.object({ id: uuid });
const classSchema = z.object({ classId: uuid });

const guard = { preHandler: authenticate };

export async function timetableRoutes(app: FastifyInstance): Promise<void> {
  // Administrators build and edit the timetable.
  app.get("/timetable", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    reply.send(ok(toCamelCase(await listEntries(actor.schoolId, validateQuery(request, listSchema)))));
  });

  app.post("/timetable", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    reply.status(201).send(created(toCamelCase(await createEntry(actor.schoolId, actor.userId, validateBody(request, entrySchema)))));
  });

  app.put("/timetable/:id", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    const { id } = validateParams(request, idSchema);
    reply.send(ok(toCamelCase(await updateEntry(actor.schoolId, actor.userId, id, validateBody(request, patchSchema)))));
  });

  app.delete("/timetable/:id", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    const { id } = validateParams(request, idSchema);
    await deleteEntry(actor.schoolId, actor.userId, id);
    reply.send(ok({ deleted: true }));
  });

  app.post("/timetable/copy", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    reply.send(ok(toCamelCase(await copyEntries(actor.schoolId, actor.userId, validateBody(request, copySchema)))));
  });

  app.post("/timetable/import", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requirePermission(actor, "timetable:manage");
    const { entries } = validateBody(request, importSchema);
    reply.send(ok(toCamelCase(await importEntries(actor.schoolId, actor.userId, entries))));
  });

  // Students.
  app.get("/student/timetable", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await getStudentTimetable(actor))));
  });

  app.get("/student/timetable/today", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await getStudentToday(actor))));
  });

  app.get("/student/timetable/week", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(groupByDay(await getStudentTimetable(actor)))));
  });

  app.get("/student/next-class", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["student"]);
    reply.send(ok(toCamelCase(await getStudentNextClass(actor))));
  });

  // Teachers (and other staff) see the lessons they are timetabled for.
  app.get("/teacher/timetable", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    requireRole(actor, ["teacher", "owner", "admin"]);
    reply.send(ok(toCamelCase(await getTeacherTimetable(actor))));
  });

  // A class's timetable: administrators, teachers, the class's students and their parents.
  app.get("/classes/:classId/timetable", guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = getAuthContext(request);
    const { classId } = validateParams(request, classSchema);

    if (!isAdminRole(actor.role) && actor.role !== "teacher") {
      if (actor.role !== "student" && actor.role !== "parent") throw new ForbiddenError();
      const visible = await query<{ id: string }>("SELECT id FROM students WHERE school_id = $1 AND current_class_id = $2", [actor.schoolId, classId]);
      let allowed = false;
      for (const row of visible.rows) {
        try {
          await getStudentById(actor, row.id);
          allowed = true;
          break;
        } catch {
          /* not visible to this user */
        }
      }
      if (!allowed) throw new ForbiddenError("You can only view the timetable of your own class.");
    }

    const filters = validateQuery(request, listSchema);
    reply.send(ok(toCamelCase(await listEntries(actor.schoolId, { ...filters, classId }))));
  });
}
