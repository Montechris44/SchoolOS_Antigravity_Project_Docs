# SchoolOS Backend API Reference

Base URL: `http://localhost:4000/api/v1` (configurable via `PORT`/`CORS_ORIGIN` in `.env`).

All responses are JSON. Successful responses are `{ "success": true, "data": ... }`. Errors are
`{ "error": "<ErrorName>", "message": "<human message>" }` (validation errors additionally include
a `details` array of `{ path, message }`).

Authenticated routes require `Authorization: Bearer <token>`, a JWT returned by register/login
containing `{ sub, schoolId, membershipId, role }`. All routes below (except Super Admin) are
tenant-scoped to the caller's `schoolId` from the token — there is no way to address another
school's data by ID.

**Super Admin routes are a separate identity, not a tenant role.** Their tokens carry
`{ sub, scope: "super_admin" }` instead, are issued by a different login endpoint, and are
rejected by every tenant route (and vice versa) — see `docs/phase-8-super-admin.md`.

## Auth — `modules/auth`

| Method | Path | Auth | Permission | Notes |
|---|---|---|---|---|
| POST | `/auth/register-school` | none | — | Creates school + owner profile + membership + default academic calendar. Returns a session. |
| POST | `/auth/login` | none | — | Email/password. Locks the account for 15 min after 5 failed attempts. |
| GET | `/me` | required | — | Current user + school + role. |

## Schools — `modules/schools`

| Method | Path | Permission |
|---|---|---|
| GET | `/schools/:schoolId` | `school:manage` |
| PATCH | `/schools/:schoolId` | `school:manage` |

## People & Academic Structure

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/classes` | `classes:view` / `classes:manage` |
| GET/POST | `/subjects` | `classes:view` / `classes:manage` |
| GET/POST | `/guardians` | `students:view` / `students:manage` |
| GET | `/students`, `/students/:studentId` | `students:view` |
| POST | `/students` | `students:manage` |
| GET/POST | `/staff` | `staff:manage` (both) |
| GET/POST | `/academic-sessions` | `classes:view` / `school:manage` |
| GET/POST | `/terms` | `classes:view` / `school:manage` |

## Attendance & Grades

| Method | Path | Permission |
|---|---|---|
| GET | `/attendance?classId=&date=` | `attendance:mark` or `attendance:view_all` |
| POST | `/attendance` | `attendance:mark` |
| GET/POST | `/assessments` | `academics:enter_scores` (both) |
| GET | `/scores?assessmentId=` | `academics:enter_scores` |
| POST | `/scores` | `academics:enter_scores` |

## Finance & Payments

| Method | Path | Permission |
|---|---|---|
| GET | `/fee-structures` | `finance:view` |
| GET/POST | `/invoices` | `finance:view` / `finance:manage` |
| GET | `/payments`, `/receipts` | `finance:view` |
| POST | `/payments/manual` | `payments:record` |
| POST | `/payments/initialize` | `payments:record` |
| POST | `/payments/webhook` | none (HMAC-verified when a live Paystack key is configured) |

## Communication, Intelligence, Actions, AI

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/announcements` | `communication:send` (both) |
| GET | `/intelligence/signals`, `/intelligence/health` | `intelligence:view` |
| GET/POST | `/actions` | `actions:manage` (both) |
| PATCH | `/actions/:actionId` | `actions:manage` |
| POST | `/ai/chat` | `ai:query` (plus a per-tool permission check inside) |

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

`owner`, `admin`, `bursar`, `teacher`, `parent`, `student` — see `src/config/rbac.ts` for the full
permission matrix (mirrors `lib/auth/types.ts` on the frontend).
