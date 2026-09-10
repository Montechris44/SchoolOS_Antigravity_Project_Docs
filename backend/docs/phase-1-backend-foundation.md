# Phase 1: Backend Foundation

## Scope

Phase 1 establishes the standalone backend foundation without connecting it to the frontend.

Built in this phase:

- Fastify application bootstrap in `src/app.ts` and `src/server.ts`
- Environment loading and validation through `.env`
- Raw PostgreSQL connection pool using `pg`
- Shared error classes and centralized error handling
- Shared Zod validation helpers
- JWT authentication middleware primitives
- RBAC permission map copied from the frontend auth model
- Tenant guard helpers for cross-school protection
- Health module using the service, controller, and routes pattern
- Backend `.gitignore`
- Backend `.env.example`

## Module Pattern

Each backend module should follow this structure:

```text
src/modules/<module-name>/
  <module-name>.service.ts
  <module-name>.controller.ts
  <module-name>.routes.ts
```

The `health` module is the first implementation of that pattern.

## Routes Added

- `GET /health`
- `GET /api/v1/health`

The health endpoint checks application boot status and attempts a simple PostgreSQL `SELECT 1`.

## Security Foundation

The RBAC map currently mirrors the frontend roles and permissions:

- `owner`
- `admin`
- `bursar`
- `teacher`
- `parent`
- `student`

Shared guards are available for:

- Permission checks
- Same-school tenant checks
- Combined school and permission checks

## Environment

Copy `.env.example` to `.env` locally and fill in real values before running the backend.

Required values:

- `DATABASE_URL`
- `JWT_SECRET`

Secrets must stay in `.env`. The backend `.gitignore` excludes `.env` files while keeping `.env.example` tracked.

## Verification

Run from `backend/`:

```bash
npm run build
```

The server is not linked to the frontend in this phase.
