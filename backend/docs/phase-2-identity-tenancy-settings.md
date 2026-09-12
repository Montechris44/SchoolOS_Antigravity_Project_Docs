# Phase 2: Identity, Tenancy, and Settings

## Scope

Real authentication and school-settings management, replacing the frontend's mock-authenticated prototype.

Built in this phase:

- `auth` module: `POST /auth/register-school`, `POST /auth/login`, `GET /me`
- `schools` module: `GET /schools/:schoolId`, `PATCH /schools/:schoolId`
- `shared/audit/audit-log.ts`: `recordAuditLog()` helper, wired into registration and settings updates
- `shared/text/slug.ts`: school slug generation with uniqueness retry
- `shared/http/case.ts`: recursive snake_case → camelCase mapper used by every module's controller so DB rows can be returned directly in the shape the frontend's TypeScript types expect

## Key decisions

- **Self-rolled auth, not Supabase Auth.** Phase 1 already committed to bcrypt + JWT (dependencies were installed, no Supabase Auth calls exist in the backend). Migration `0003_auth_columns.sql` adds `password_hash`, `failed_login_count`, and `locked_until` to `profiles`. The existing RLS policies (which assume `auth.uid()`) are left in place as inert defense-in-depth; authorization is enforced in the application layer via `shared/security/tenant-guard.ts`, consistent with Phase 1.
- **Login lockout.** 5 failed attempts locks the account for 15 minutes (`auth.service.ts`), borrowed from a pattern in the sibling Nexora-back project.
- **Default academic calendar on registration.** A new school has no way to create an Academic Session or Term through the UI yet, but Attendance and Assessments require a current term. `registerSchool()` auto-creates a Nigerian-style Sep–Jul session with three terms and marks whichever one contains today's date as current (falls back to First Term otherwise). See `buildDefaultAcademicCalendar()` in `auth.service.ts`.
- **JWT payload** is `{ sub, schoolId, membershipId, role }`, matching what `middleware/auth.ts` already expected and what the frontend's `AuthSession` type consumes — no reshaping needed on either side.

## Two DB type-parser fixes (apply to every later phase too)

Found while smoke-testing this phase against the live Supabase database, fixed in `src/db/pool.ts`:

- **DATE columns** were coming back as JS `Date` objects at local midnight, which shifted a day backward once serialized to JSON/UTC. Fixed by overriding the type parser for OID 1082 to return the raw `"YYYY-MM-DD"` string.
- **NUMERIC columns** were coming back as strings (pg's default, to avoid float rounding). Fixed by overriding the type parser for OID 1700 to `parseFloat`, matching the frontend's `number`-typed fields.

## Routes Added

- `POST /api/v1/auth/register-school`
- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `GET /api/v1/schools/:schoolId`
- `PATCH /api/v1/schools/:schoolId`

## Frontend

- `app/page.tsx`: real public landing page (was a redirect-to-dashboard stub)
- `app/register/page.tsx`, `app/login/page.tsx`: real forms wired to the endpoints above
- `lib/api/client.ts`, `lib/api/auth.ts`: fetch wrapper + typed auth calls
- `lib/auth/auth-context.tsx`: rewritten to hold a real session (token in `localStorage`, hydrated via `/me` on load) instead of auto-authenticating as a mock owner
- `components/layout/app-shell.tsx`: redirects to `/login` when unauthenticated instead of showing fake "Sign in as Owner/Teacher/Parent" buttons
- `components/layout/header.tsx`: dropped the fake persona/tenant switcher (it swapped in canned mock identities; with a real session and real RBAC enforced server-side, a client-only "become a different role" control would be actively misleading)

## Verification

Live-tested against the real Supabase Postgres instance: register → login → `/me` → settings update, including duplicate-email rejection and lockout fields. See `backend/tests/auth.test.ts`.
