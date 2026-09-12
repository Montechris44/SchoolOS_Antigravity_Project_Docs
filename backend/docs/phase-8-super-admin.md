# Phase 8: Super Admin (Platform Authority)

## Scope

A platform-level identity with final authority over every school's lifecycle — modeled after
the equivalent feature in the sibling Nexora-back project, adapted to fit SchoolOS's schema.

Module: `super-admin` (`src/modules/super-admin/`).

## Key decisions

- **A completely separate identity, not a role.** Nexora's super admin lives in its own
  `super_admins` table rather than as a row in the tenant `users` table, and SchoolOS follows
  the same pattern: `super_admins` (migration `0007_super_admin.sql`) is wholly independent of
  `profiles`/`memberships`. A super admin has no `school_id` and is never a member of any school.
  This was the deliberate choice over adding `"super_admin"` to the existing `UserRole` union in
  `config/rbac.ts` — that union and its `ROLE_PERMISSIONS` map are specifically about
  school-membership permissions, and a super admin bypasses that whole system rather than holding
  a permission set within it.
- **A structurally distinct JWT, not a shared one with an extra claim.** Tenant tokens carry
  `{ sub, schoolId, membershipId, role }`; super admin tokens carry `{ sub, scope: "super_admin" }`
  and nothing else. `middleware/super-admin-auth.ts#authenticateSuperAdmin` checks
  `payload.scope === "super_admin"` before trusting a token, and `middleware/auth.ts#authenticate`
  never looks at `scope` at all. This makes cross-contamination fail closed in both directions —
  verified directly in `tests/super-admin.test.ts`:
  - A tenant token hitting `/super-admin/*` is rejected at the auth layer (`401`) because it has
    no `scope` claim.
  - A super-admin token hitting a tenant route (e.g. `/students`) passes JWT verification (it's a
    valid signed token) but then fails every permission check, because `role`/`schoolId` are
    `undefined` and `hasPermission(undefined, ...)` returns `false` — a `403`, not a crash or a
    silent bypass.
- **Login mirrors the existing tenant lockout pattern** (5 failed attempts → 15-minute lock,
  same constants as `modules/auth/auth.service.ts`) for consistency within this codebase, rather
  than copying Nexora's 30-minute window verbatim.
- **No public endpoint creates a super admin**, matching Nexora exactly — the only way to
  provision one is `npm run seed:super-admin -- --email ... --password ... --name ...`
  (`src/db/seed-super-admin.ts`), run by whoever operates the deployment.
- **Suspension is enforced at the tenant login gate.** `PATCH /super-admin/schools/:id/status`
  flips `schools.status` between `ACTIVE`/`SUSPENDED`; `auth.service.ts#login` rejects with `403`
  if the resolved school is suspended. This is a deliberate, documented tradeoff shared with
  Nexora's own design: enforcement happens at the login front door, not on every subsequent
  request for an already-issued token — adding a DB round-trip to `authenticate` (which is
  currently a pure, zero-query JWT verification) would add latency to *every* API call across the
  whole app to guard against a rare event. A suspended school's already-logged-in users keep
  working until their token expires (`JWT_EXPIRES_IN`, default `1d`) or they log in again.
- **Audit logging is unified with the existing tenant audit trail**, not a separate table.
  `audit_logs` gained a nullable `super_admin_id` column (parallel to the existing nullable
  `user_id`) and `school_id` was relaxed to nullable, since some super-admin actions
  (unlocking a profile) aren't inherently about one school row. `shared/audit/audit-log.ts`'s
  `AuditLogEntry` grew an optional `superAdminId` field; existing callers are unaffected.
- **What's included vs. what Nexora has that SchoolOS doesn't need**: no subscriptions/billing
  plans, no "organizations" tenant tier, no endpoint to create schools (schools already
  self-register via `POST /auth/register-school`) — none of that exists in SchoolOS's domain
  today. What *is* included: list/search all schools with live member/student/staff counts,
  suspend/reactivate a school (with an optional reason recorded in the audit log), a cross-tenant
  user directory, platform-wide analytics, an audit log viewer, and unlocking a locked-out
  profile (a real support action — resets `failed_login_count`/`locked_until` on `profiles`).

## Routes Added

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/super-admin/auth/login` | none |
| GET | `/api/v1/super-admin/me` | super admin |
| GET | `/api/v1/super-admin/schools` | super admin |
| GET | `/api/v1/super-admin/schools/:schoolId` | super admin |
| PATCH | `/api/v1/super-admin/schools/:schoolId/status` | super admin |
| GET | `/api/v1/super-admin/users` | super admin |
| POST | `/api/v1/super-admin/profiles/:profileId/unlock` | super admin |
| GET | `/api/v1/super-admin/analytics` | super admin |
| GET | `/api/v1/super-admin/audit-logs` | super admin |

## Frontend

A standalone panel, deliberately outside the tenant app's `AppShell`/`AuthProvider` (a super
admin session has nothing to do with a school session — the two coexist in separate
`localStorage` keys, `schoolos_token` vs `schoolos_super_admin_token`):

- `app/super-admin/login/page.tsx`
- `app/super-admin/page.tsx` — analytics summary, and Schools / Users / Audit Logs tabs;
  suspend/reactivate is a confirm dialog (with an optional reason field when suspending)
- `lib/api/super-admin.ts`, and `superAdminApiRequest` in `lib/api/client.ts`

## Verification

Live-tested against the real Supabase database: seeded a super admin, logged in via the API and
via the real browser panel, listed schools, suspended a real registered school and confirmed its
owner's login was immediately rejected (`403`), reactivated it and confirmed login succeeded
again, confirmed both actions appear correctly attributed in the audit log, and confirmed a
tenant token and a super-admin token each fail closed on the other's routes. Covered by
`backend/tests/super-admin.test.ts` (7 assertions) and a full Playwright run through the actual
login → dashboard → suspend → reactivate → users → audit logs → logout flow with zero client-side
JS errors.
