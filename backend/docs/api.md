# SchoolOS Backend API Reference

Base URL: `http://localhost:4000/api/v1` (configurable via `PORT`/`CORS_ORIGIN` in `.env`).

All responses are JSON. Successful responses are `{ "success": true, "data": ... }`. Errors are
`{ "error": "<ErrorName>", "message": "<human message>" }` (validation errors additionally include
a `details` array of `{ path, message }`).

Authenticated routes require `Authorization: Bearer <token>`, a short-lived (30 min by default) JWT
returned by register/login containing `{ sub, schoolId, membershipId, role, fpc }`. Renew it with
the rotating refresh token from the same response (`POST /auth/refresh`). When `fpc` is true (a
temporary password is still in use) every route except `/me`, `/auth/change-password`,
`/auth/force-update-password` and `/auth/logout*` answers `403 PasswordChangeRequired`.

All routes below (except Super Admin) are tenant-scoped to the caller's `schoolId` from the token —
there is no way to address another school's data by ID.

**Super Admin routes are a separate identity, not a tenant role.** Their tokens carry
`{ sub, scope: "super_admin" }` instead, are issued by a different login endpoint, and are
rejected by every tenant route (and vice versa) — see `docs/phase-8-super-admin.md`.

## Auth — `modules/auth`

Everyone signs in through the same endpoint; the role comes from the user's membership.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register-school` | none | Creates school + owner profile + membership + default academic calendar. Returns a session. |
| POST | `/auth/login` | none | Email/password. Timing-equalised; 5 failures lock the account for 15 min. Returns `{ token, refreshToken, mustChangePassword, user, school }`. Student/parent sign-in is refused when the school switched that portal off. |
| POST | `/auth/refresh` | refresh token | Rotates the refresh token. Re-using an old one revokes the whole token family. |
| POST | `/auth/logout`, `/auth/logout-all` | required | Revoke this device / every device. |
| POST | `/auth/change-password` | required | Needs the current password; ends all other sessions and returns a fresh session. |
| POST | `/auth/force-update-password` | required | First-login replacement of a temporary password. |
| POST | `/auth/forgot-password`, `/auth/reset-password` | none | Emailed one-time link (token stored hashed, 1 h expiry). Always answers 200 so accounts cannot be enumerated. |
| GET | `/me` | required | Current user + school + role. |

Temporary passwords are random (never derived from a name), are shown once to the administrator who
created or reset the account, and force a change at first sign-in.

## Schools & school settings

| Method | Path | Permission |
|---|---|---|
| GET/PATCH | `/schools/:schoolId` | `school:manage` |
| GET | `/school-settings` | any signed-in member |
| PATCH | `/school-settings` | `school:manage` — pass mark, ranking mode (average / grade counts), staff sign-in cut-offs, student e-mail domain, school code, theme colour, student/parent portal switches |
| POST | `/school-settings/logo` | `school:manage` — multipart; PNG/JPEG/WebP verified by magic bytes |
| GET/PUT | `/grading-system` | view / `school:manage` (bands must cover 0–100 without gaps or overlaps) |
| GET | `/grading-system/preview?score=` | any signed-in member |

## Calendar

| Method | Path | Permission |
|---|---|---|
| GET | `/academic-status` | sessions, terms, current session/term in one call |
| GET/POST | `/academic-sessions` | `classes:view` / administrator |
| PATCH | `/academic-sessions/:sessionId/set-current` | administrator |
| GET/POST | `/terms` | `classes:view` / administrator |
| PATCH | `/terms/:termId/set-current`, `/deactivate`, `/reactivate` | administrator. Deactivated terms are read-only for teachers. |

## People & academic structure

| Method | Path | Notes |
|---|---|---|
| GET/POST/DELETE | `/classes`, `/classes/:classId` | classes include their arms and class teacher |
| POST/PATCH/DELETE | `/class-arms`, `/class-arms/:armId` | |
| PATCH/DELETE | `/classes/:classId/class-teacher`, `/class-arms/:armId/class-teacher` | assign / clear a class teacher |
| GET/POST/PATCH | `/subjects`, `/subjects/:subjectId`, `/subjects/:subjectId/toggle` | |
| GET/POST | `/subjects/catalog`, `/subjects/from-catalog` | pick from the global subject list |
| GET/POST/DELETE | `/teacher-assignments` | teacher ↔ class/arm ↔ subject; drives what a teacher may see and score |
| GET/POST/PATCH/DELETE | `/staff`, `/staff/:userId`, `/staff/:userId/toggle`, `/staff/:userId/reset-password`, `/staff/:userId/schedule` | roles: admin, teacher, bursar, non_academic |
| GET/POST/PATCH | `/students`, `/students/:studentId`, `/students/:studentId/academic-summary` | responses are scoped: teachers → their classes, parents → their children, students → themselves |
| POST | `/students` | returns `{ ...student, credentials }` — the temporary sign-in is shown once |
| POST | `/students/bulk-import`, `/students/:studentId/photo`, `/students/:studentId/portal-account`, `/students/:studentId/reset-password` | |
| GET/POST | `/guardians` (+ `POST /guardians/:guardianId/portal-account`) | |

## Attendance

| Method | Path | Notes |
|---|---|---|
| GET | `/attendance/roster`, `/attendance`, `/attendance/overview`, `/attendance/rates` | teachers only for classes they are assigned to |
| POST | `/attendance` | mark a class register |
| GET | `/attendance/me`, `/attendance/students/:studentId` | student / parent views |
| GET | `/staff-attendance`, `/staff-attendance/history/:staffId` | administrators |
| POST | `/staff-attendance/clock-in`, `/clock-out` | the **server clock** decides ON_TIME / LATE / VERY_LATE |
| GET | `/staff-attendance/me`, `/me/history`, `/session` | |
| POST | `/staff-attendance/mark`, `/session/open`, `/session/close` | administrators |
| GET/POST/PATCH | `/leave-passes`, `/leave-passes/:id` | student leave passes |
| GET/POST/PATCH | `/staff-leave`, `/staff-leave/mine`, `/staff-leave/:id/review`, `/staff-leave/:id/cancel` | staff leave |

## Results workflow

Teacher CA scheme → scores → publish to class teacher → class teacher review / return / submit →
administrator approve / return → release (positions computed, report cards snapshotted).

| Method | Path | Role |
|---|---|---|
| GET | `/results/my-classes`, `/results/entry-sheet`, `/results/ca-scheme` | subject teacher |
| POST | `/results/ca-scheme`, `/results/scores`, `/results/publish-to-class-teacher` | subject teacher (scores lock after submission) |
| GET | `/results/class-teacher-overview`, `/results/class-teacher-subject-sheet` | class teacher |
| POST | `/results/class-teacher-return`, `/results/class-teacher-publish` | class teacher |
| GET | `/results/approval-queue`, `/approval-queue/metrics`, `/approval-queue/publish-readiness`, `/approval-queue/:batchId` | administrator |
| POST | `/results/approval-queue/:batchId/approve`, `/:batchId/return`, `/approval-queue/publish-class` | administrator |
| GET | `/results/my`, `/results/published/:studentId`, `/results/report-card`, `/student/report-card` | student / parent — released results only |
| GET | `/results/students/:studentId/terms/:termId` | staff review |

## Timetable, homework, events, messaging

| Method | Path |
|---|---|
| GET/POST/PUT/DELETE | `/timetable`, `/timetable/:id`; POST `/timetable/copy`, `/timetable/import`; GET `/classes/:classId/timetable`, `/teacher/timetable` |
| GET | `/student/timetable`, `/student/timetable/today`, `/student/timetable/week`, `/student/next-class` |
| GET/POST/DELETE | `/assignments`, `/assignments/:assignmentId`; GET `/assignments/:assignmentId/submissions`; PATCH `/assignments/:assignmentId/submissions/:studentId/grade` |
| GET/PATCH/POST | `/assignments/my`, `/assignments/my/summary`, `/assignments/my/:assignmentId`, `/assignments/my/:assignmentId/files` (student side) |
| GET/POST/PUT/DELETE | `/events`, `/events/:eventId` |
| GET/POST/PATCH/DELETE | `/messages/inbox`, `/sent`, `/contacts`, `/unread-count`, `/:messageId/thread`; POST `/messages`, `/messages/broadcast`; PATCH `/messages/:messageId/read`, `/messages/broadcasts/:broadcastId/read`; DELETE `/messages/:messageId` |
| GET/PATCH | `/notifications`, `/notifications/unread-count`, `/notifications/:notificationId/read`, `/notifications/read-all` |

Contacts and broadcasts are role-aware: students can message their teachers, parents their
children's teachers, staff anyone in their own school — never another school.

## Dashboards & family portals

| Method | Path |
|---|---|
| GET | `/dashboard/admin`, `/dashboard/teacher`, `/dashboard/student`, `/dashboard/staff` |
| GET | `/student/profile`, `/student/academic-status`, `/student/fees` |
| GET | `/parent/children`, `/parent/children/:studentId/summary`, `/parent/children/:studentId/fees` |

## Finance & payments

| Method | Path | Permission |
|---|---|---|
| GET | `/fee-structures` | `finance:view` |
| GET/POST | `/invoices` | `finance:view` / `finance:manage` — parents/students only see their own |
| GET | `/payments`, `/receipts` | `finance:view` — scoped the same way |
| POST | `/payments/manual` | `payments:record` |
| POST | `/payments/initialize` | `payments:record` |
| POST | `/payments/webhook` | none (HMAC-verified when a live Paystack key is configured) |

## Communication, intelligence, actions, AI

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/announcements` | `communication:send` (both) |
| GET | `/intelligence/signals`, `/intelligence/health` | `intelligence:view` |
| GET/POST | `/actions` | `actions:manage` (both) |
| PATCH | `/actions/:actionId` | `actions:manage` |
| POST | `/ai/chat` | `ai:query` (plus a per-tool permission check inside) |

`/assessments` and `/scores` (`academics:enter_scores`) are unchanged and remain available next to
the results workflow above.

## Super Admin — `modules/super-admin` (separate identity, see note above)

| Method | Path | Auth |
|---|---|---|
| POST | `/super-admin/auth/login` | none |
| GET | `/super-admin/me` | super admin |
| GET | `/super-admin/schools` | super admin |
| GET | `/super-admin/schools/:schoolId` | super admin |
| PATCH | `/super-admin/schools/:schoolId/status` | super admin |
| GET | `/super-admin/users` | super admin |
| POST | `/super-admin/profiles/:profileId/unlock` | super admin |
| GET | `/super-admin/analytics` | super admin |
| GET | `/super-admin/audit-logs` | super admin |

There is no public endpoint to create a super admin — provision one with
`npm run seed:super-admin -- --email ... --password ... --name ...` from `backend/`.

## Health

| Method | Path |
|---|---|
| GET | `/health` and `/api/v1/health` |

## Roles

`owner`, `admin`, `bursar`, `teacher`, `non_academic`, `parent`, `student` — see `src/config/rbac.ts`
for the full permission matrix (mirrors `lib/auth/types.ts` on the frontend).

## Security notes

- **Tenancy:** `schoolId` always comes from the verified token. Every query filters on it, and every
  id in a request body/query (student, class, arm, subject, term, teacher, batch…) is checked to
  belong to the caller's school before use (`src/shared/security/`). Foreign ids return 404 (or 400
  when they arrive inside a batch payload such as scores).
  `tests/portal-isolation.test.ts` exercises this across the new modules.
- **Role scoping:** teachers see only students/classes they are assigned to; parents only their
  children; students only themselves — for students, guardians, invoices, payments, attendance,
  results, leave and messages.
- **Sessions:** 30-minute access tokens; refresh tokens are random, stored as SHA-256 hashes,
  rotated on use, and reuse revokes the family. Password changes end every other session.
- **Passwords:** minimum 8 characters with a letter and a number; random temporary passwords with a
  forced change; account lockout; audit log for sign-ins, resets, approvals and releases.
- **Results integrity:** totals and grades are computed server-side; scores lock once submitted;
  students and parents only ever receive released (`PUBLISHED`) results.
- **Uploads:** size-limited and checked by magic bytes, not by the client-supplied type.
- **Database:** new tables have RLS enabled with no policies, so the API's own role remains the only
  path in; the application-level `school_id` filters are the isolation boundary.
