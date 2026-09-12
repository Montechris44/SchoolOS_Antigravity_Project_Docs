# Phase 7: Hardening and Docs

## Scope

Backend integration tests, build verification, an API reference, and the phase docs in this folder.

## Tests

`backend/tests/*.test.ts`, run with Node's built-in test runner against the **real** Supabase Postgres database (no mocking of the DB layer) using Fastify's `app.inject()` — no network listener needed:

- `auth.test.ts` — register, duplicate-email rejection, login (success/failure), `/me` auth gate
- `tenant-isolation.test.ts` — school A cannot see school B's classes, cannot enroll a student into school B's class, cannot patch school B's settings
- `payments.test.ts` — a Paystack webhook replay does not double-credit an invoice or create a second payment row

Each test file creates its own throwaway school(s) and deletes them in a `t.after()` hook, so the suite leaves the database exactly as it found it. Run from `backend/`:

```bash
npm test
```

## What's *not* covered here

This is a smoke suite over the highest-risk paths (auth, tenant isolation, money), not exhaustive per-endpoint coverage. The frontend's pre-existing `tests/*.test.js` files (`payments.test.js`, `intelligence.test.js`, etc.) were left untouched — they're self-contained "contract" tests that reimplement toy versions of logic inline and assert against that reimplementation; they never imported real application code before this project and still don't, so nothing about this backend build affected them either way.

## Build verification

- `cd backend && npm run build` — clean `tsc` compile
- `npm run build` (repo root) — clean Next.js production build of all pages
- `npm run typecheck` (repo root) — clean

## API Reference

See `backend/docs/api.md` for the full endpoint list.
