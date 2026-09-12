# SchoolOS Backend

Standalone Fastify + PostgreSQL API for SchoolOS, built in 8 phases — see `docs/phase-*.md` for
what each phase added and why, and `docs/api.md` for the full endpoint reference.

## Stack

- [Fastify](https://fastify.dev/) 5
- Raw `pg` (no ORM) with a hand-rolled migration runner
- `zod` for request validation
- `bcryptjs` + `@fastify/jwt` for auth (no Supabase Auth — see `docs/phase-2-identity-tenancy-settings.md`)
- Paystack REST API for payments, with a sandbox fallback when no live key is configured

## Getting started

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and a real JWT_SECRET
npm run migrate        # applies db/migrations/*.sql in order, tracked in schema_migrations
npm run dev            # ts-node-dev, auto-restarts on change
```

`DATABASE_URL` needs SSL for any non-localhost host (e.g. Supabase's pooler) — `src/db/pool.ts`
enables it automatically unless the host is `localhost`/`127.0.0.1`.

To provision the platform-level super admin (see `docs/phase-8-super-admin.md`) — there is no
public signup for this, it's operator-only:

```bash
npm run seed:super-admin -- --email you@example.com --password "a-real-password" --name "Your Name"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the API with hot reload |
| `npm run build` | Compile to `dist/` with `tsc` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run migrate` | Apply any not-yet-applied `db/migrations/*.sql` files |
| `npm run seed:super-admin` | Create a super admin account (operator-only, no public endpoint) |
| `npm test` | Run the integration test suite against the configured database |

## Project layout

```text
src/
  app.ts, server.ts       Fastify bootstrap
  config/                 env validation, RBAC permission map
  db/                     pg pool + migration runner
  middleware/              JWT auth
  modules/<name>/          <name>.schemas.ts, .service.ts, .controller.ts, .routes.ts
  routes/                  central route registration
  shared/                  errors, response helpers, validation, tenant guard, audit log
db/migrations/             numbered .sql files, applied in order and tracked in schema_migrations
tests/                     integration tests (Fastify .inject(), real DB, self-cleaning)
docs/                      phase-by-phase build log + API reference
```

Every module after `health` follows the same four-file pattern; copy an existing one (e.g.
`modules/classes`) as a template for a new one.

## Multi-tenancy

Every authenticated route reads `schoolId` from the JWT, not from the URL or body — there is no
way for a request to address another school's data by ID. The one exception is
`schools/:schoolId`, which addresses the caller's own school explicitly.

## Super admin

A platform-level identity, completely separate from tenant users — its own table
(`super_admins`), its own login (`/super-admin/auth/login`), its own JWT shape, and final
authority to suspend/reactivate any school. See `docs/phase-8-super-admin.md`.
