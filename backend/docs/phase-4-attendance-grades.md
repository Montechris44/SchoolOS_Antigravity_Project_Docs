# Phase 4: Attendance and Grades

## Scope

Daily attendance registers and continuous-assessment score entry.

Modules: `attendance`, `assessments`, `scores`.

## Key decisions

- **Attendance marking is an upsert.** `POST /attendance` takes `{classId, date, records[]}` and upserts each student's record on the `(school_id, class_id, student_id, date)` unique constraint, so re-submitting a register (e.g. correcting one student) never creates duplicates.
- **Assessments default to the current term.** `POST /assessments` accepts an optional `termId`; if omitted it resolves via `terms.service.ts#getCurrentTermId`, which prefers the term flagged `is_current` and falls back to the most recently started one. This is what lets the frontend's "New Assessment" dialog stay a single-step form without a term picker.
- **Scores are also an upsert**, keyed on `(school_id, assessment_id, student_id)`, so re-saving a marksheet updates existing scores rather than erroring or duplicating.
- **Report Card generation was left untouched.** The frontend's "Terminal Report Cards" tab (`modules/academics/grading-engine.ts`) was already a pure client-side calculator working on fabricated example numbers, not on `mock-db` data — there was nothing to "wire" there. Real term-aggregated report cards (position ranking, cross-subject GPA) would be a separate feature.

## Routes Added

- `GET/POST /api/v1/attendance`
- `GET/POST /api/v1/assessments`
- `GET/POST /api/v1/scores`

## Frontend

`app/attendance/page.tsx` and the Mark Entry / Assessments tabs of `app/academics/page.tsx` now call `lib/api/{attendance,assessments,scores}.ts`.

## Verification

Live-tested: mark a register, create an assessment (letting it default to the current term), record scores, re-save to confirm the upsert. See `backend/tests/` for the shared auth/tenant coverage these routes sit behind.
