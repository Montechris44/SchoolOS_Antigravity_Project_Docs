# Phase 3: People and Academics Base

## Scope

Core school-structure entities: classes, subjects, guardians, students, staff, academic sessions, and terms.

Modules: `classes`, `subjects`, `guardians`, `students`, `staff`, `academic-sessions`, `terms`.

## Key decisions

- **Tenant scoping is implicit**, not part of the URL. Every route after Phase 2 reads `schoolId` from the authenticated JWT (`actor.schoolId`), not from a path or body parameter. This removes an entire class of bugs (a client-supplied schoolId disagreeing with the token) and matches how most multi-tenant APIs are shaped. `schools/:schoolId` from Phase 2 is the one deliberate exception, since it addresses the school's own resource.
- **Students carry denormalized fields** (`currentClassName`, `guardianName/Phone/Email`) computed via SQL joins in `students.service.ts`, matching the shape the frontend's `Student` type already expects.
- **Inline guardian creation.** `POST /students` accepts an optional `guardian` object; `guardians.service.ts#findOrCreateGuardian` reuses an existing guardian (matched on phone + email within the school) or creates one, inside the same transaction as the student insert.
- **Staff creation provisions a real login.** `staff` rows require a `user_id` FK to `profiles`, so `POST /staff` creates a profile (bcrypt-hashed password) + membership + staff row in one transaction — the same shape as school registration, but joining an existing school with a non-owner role.
- **"Add Subject" UI was missing entirely.** The original mock frontend never had a way to create a subject (subjects were pre-seeded mock data). Since Assessments require at least one real subject, this was a genuine gap that would leave every freshly-registered school unable to use Academics at all. Added a minimal "Add Subject" modal to `app/people/page.tsx`'s Sessions & Terms tab, backed by `POST /subjects`.

## Routes Added

- `GET/POST /api/v1/classes`
- `GET/POST /api/v1/subjects`
- `GET/POST /api/v1/guardians`
- `GET /api/v1/students`, `GET /api/v1/students/:studentId`, `POST /api/v1/students`
- `GET/POST /api/v1/staff`
- `GET/POST /api/v1/academic-sessions`
- `GET/POST /api/v1/terms`

## Frontend

`app/people/page.tsx` and the class/subject/session portions of `app/settings/page.tsx` now call the endpoints above via `lib/api/{classes,subjects,students,staff}.ts` instead of `lib/db/mock-db.ts`.

## Verification

Live-tested: class → student (with inline guardian) → staff → academic session/term, all against the real database. See `backend/tests/tenant-isolation.test.ts` for the cross-school access checks on these same endpoints.
