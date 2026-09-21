import { z } from "zod";

const uuid = z.string().uuid();

/** Component keys become JSON object keys in stored scores, so they stay simple identifiers (ca1, test2, ...). */
const componentKey = z
  .string()
  .regex(/^[a-z][a-z0-9]{0,19}$/, "Use lowercase letters and digits only, e.g. ca1");

export const caComponentSchema = z.object({
  key: componentKey.optional(),
  name: z.string().min(1).max(40),
  maxScore: z.number().positive().max(100),
});

/** Identifies one subject sheet: a subject in a class (and arm) for a term. */
export const scopeSchema = z.object({
  classId: uuid,
  armId: uuid.nullish(),
  subjectId: uuid,
  termId: uuid,
  sessionId: uuid,
});

export type ResultScope = z.infer<typeof scopeSchema>;

export const upsertSchemeSchema = scopeSchema.extend({
  components: z.array(caComponentSchema).min(1).max(8),
  examMaxScore: z.number().positive().max(100),
});

export type UpsertSchemeInput = z.infer<typeof upsertSchemeSchema>;

export const schemeQuerySchema = z.object({
  classId: uuid,
  armId: uuid.optional(),
  subjectId: uuid,
  termId: uuid,
});

export const enterScoresSchema = scopeSchema.extend({
  scores: z
    .array(
      z.object({
        studentId: uuid,
        caComponents: z.record(componentKey, z.number().nullable()).default({}),
        examScore: z.number().nullable().default(null),
        remark: z.string().max(200).nullish(),
      })
    )
    .min(1)
    .max(500),
});

export type EnterScoresInput = z.infer<typeof enterScoresSchema>;

export const entrySheetQuerySchema = z.object({
  classId: uuid,
  armId: uuid.optional(),
  subjectId: uuid,
  termId: uuid,
  sessionId: uuid,
});

export const classTeacherOverviewQuerySchema = z.object({
  termId: uuid,
  sessionId: uuid.optional(),
  classId: uuid.optional(),
  armId: uuid.optional(),
});

export const classTeacherSheetQuerySchema = z.object({
  subjectId: uuid,
  termId: uuid,
  sessionId: uuid.optional(),
  classId: uuid.optional(),
  armId: uuid.optional(),
});

export const classTeacherReturnSchema = z.object({
  subjectId: uuid.optional(),
  termId: uuid.optional(),
  batchId: uuid.optional(),
  classId: uuid.optional(),
  armId: uuid.nullish(),
  reviewNotes: z.string().min(3).max(1000),
});

export const classTeacherPublishSchema = z.object({
  termId: uuid,
  sessionId: uuid,
  classId: uuid.optional(),
  armId: uuid.nullish(),
  teacherRemark: z.string().max(1000).optional(),
});

export const queueQuerySchema = z.object({
  sessionId: uuid.optional(),
  termId: uuid.optional(),
  classId: uuid.optional(),
  status: z.enum(["all", "pending", "approved", "released", "returned"]).optional(),
  search: z.string().max(100).optional(),
});

export const batchIdParamsSchema = z.object({ batchId: uuid });

export const returnBatchSchema = z.object({ reviewNotes: z.string().min(3).max(1000) });

export const readinessQuerySchema = z.object({
  classId: uuid,
  armId: uuid.optional(),
  termId: uuid,
  sessionId: uuid,
});

export const publishClassSchema = z.object({
  classId: uuid,
  armId: uuid.nullish(),
  termId: uuid,
  sessionId: uuid,
  principalRemark: z.string().max(1000).optional(),
});

export const studentResultQuerySchema = z.object({
  termId: uuid.optional(),
  sessionId: uuid.optional(),
});

export const studentIdParamsSchema = z.object({ studentId: uuid });
export const studentTermParamsSchema = z.object({ studentId: uuid, termId: uuid });

export const reportCardQuerySchema = z.object({
  termId: uuid.optional(),
  sessionId: uuid.optional(),
  studentId: uuid.optional(),
});
