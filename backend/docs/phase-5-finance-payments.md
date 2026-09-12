# Phase 5: Finance and Payments

## Scope

Fee structures, invoices, manual payments, and Paystack initialize/webhook handling with idempotency.

Modules: `fee-structures`, `invoices`, `payments`.

## Key decisions

- **Fee structures are read-only for now.** No UI ever wrote to `fee_structures` in the original mock either — the list endpoint returns real rows once they exist, with `items: []` since there's no line-item table for fee structures in the schema (unlike invoices, which do have `invoice_items`).
- **Invoice numbers are server-generated**: `INV-{year}-{seq}`, sequenced by counting existing invoices for the school in that year inside `invoices.service.ts#generateInvoiceNumber`. The frontend previously generated this client-side (`invoices.length + 1`), which isn't safe against concurrent issuance.
- **Paystack integration matches the existing "simulator" design, not a hosted-checkout redirect.** The pre-existing `app/payments/page.tsx` never called a real Paystack checkout — it directly POSTed a fabricated `charge.success` webhook event to prove the idempotency guarantee. That behavior is preserved exactly, now pointed at the real backend:
  - `POST /payments/initialize` calls the real Paystack API if `PAYSTACK_SECRET_KEY` is set to a real (non-"mock") value; otherwise returns a sandbox-shaped response so the flow keeps working without live credentials.
  - `POST /payments/webhook` verifies the `x-paystack-signature` HMAC SHA-512 header **only when a real secret key is configured** — otherwise it accepts unsigned events, matching the previous Next.js API route's behavior and keeping the local demo/test flow usable. This is the same "skip verification only in the unconfigured/sandbox case" pattern already used for Paystack initialization.
  - Idempotency is enforced two ways: an application-level check by `provider_reference`, and the DB's own `UNIQUE(school_id, provider_reference)` constraint as a backstop (caught via Postgres error code `23505`).
- **`recorded_by_user_id`** was added to `payments` (migration `0005_payments_recorded_by.sql`) so manual payments can show who recorded them; Paystack-originated payments show "Paystack Gateway" instead.
- **Receipts are a derived view, not a stored table.** `listReceipts()` joins `payments` (status `VERIFIED_SUCCESS`) with `invoices` and `students` — there was never a `receipts` table in the schema, matching how the mock version worked.
- Legacy `app/api/payments/{initialize,webhook}/route.ts` and `modules/payments/paystack-adapter.ts` were deleted once the frontend called the real backend directly — no reason to keep two competing implementations.

## Routes Added

- `GET /api/v1/fee-structures`
- `GET/POST /api/v1/invoices`
- `GET /api/v1/payments`, `GET /api/v1/receipts`
- `POST /api/v1/payments/manual`
- `POST /api/v1/payments/initialize`
- `POST /api/v1/payments/webhook` (unauthenticated — called by Paystack's servers, or by the frontend's demo simulator)

## Frontend

`app/finance/page.tsx` and `app/payments/page.tsx` now call `lib/api/{finance,payments}.ts`.

## Verification

Live-tested: issue an invoice, record a manual payment (invoice goes `ISSUED → PARTIAL`), then simulate a Paystack webhook for the remaining balance (invoice goes `PARTIAL → PAID`), then replay the identical webhook and confirm it's rejected as a duplicate with no double-crediting. Covered by `backend/tests/payments.test.ts`.
