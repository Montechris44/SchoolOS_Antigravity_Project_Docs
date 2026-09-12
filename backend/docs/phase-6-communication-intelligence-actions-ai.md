# Phase 6: Communication, Intelligence, Actions, AI

## Scope

Announcements, deterministic risk signals, the Action Center workflow, and a permission-checked AI query endpoint.

Modules: `announcements`, `intelligence`, `actions`, `ai`.

## Key decisions — the big one: real signals, not fabricated ones

The original `modules/intelligence/engine.ts` was almost entirely hardcoded demo content: a `LOW_ATTENDANCE` signal that only fired if a student was literally named "Chioma", a `MISSING_TEACHER_SUBMISSIONS` signal with a fake teacher name and fixed dates, and a School Health Score where only the financial component was computed from real data — attendance/academic/submission health were constants (`88`, `82`, `85`).

Since Phases 3–5 now have real attendance, invoice, and score data to work with, `intelligence.service.ts` computes actual rule-based signals instead:

- **`LOW_ATTENDANCE`**: per student, attendance rate over the last 30 days, flagged when it drops below 75% (and at least 5 days are on record, to avoid false positives for a student enrolled yesterday).
- **`OVERDUE_FEES`**: invoices with `balance_due > 0` and `due_date` in the past.
- **`MISSING_TEACHER_SUBMISSIONS`** was dropped rather than faked — there's no "expected deadline" concept modeled anywhere in the schema for assessments, so there was no honest way to compute it.
- **School Health Score**: financial health (collection ratio) and attendance health (real 30-day average) are real; academic health is the real average of `score/max_score` across all recorded scores; submission compliance is a new, real, derivable proxy — the fraction of assessments that have at least one score recorded.

Signals are computed fresh on every request (not persisted) and use deterministic string IDs like `low_attendance:<studentId>` — there's no need for a database row before an action can be created from one.

## Other decisions

- **Announcements schema was wrong and got reworked.** The original `0004_communication.sql` migration didn't match the frontend's `Announcement` type at all (no `channels` array, no delivery stats, wrong audience enum). Nothing had been written to it yet, so `0006_announcements_rework.sql` drops and recreates it correctly rather than patching in place.
- **Simulated delivery, honestly labeled.** There's no real WhatsApp/SMS provider wired up (none was in the original either). `dispatchAnnouncement()` computes a real recipient count from actual enrolled students, then simulates a 98%/2% delivered/failed split — matching the pre-existing behavior exactly, just server-side now.
- **Actions accept a signal's data directly**, not a `signalId` foreign key — since signals aren't persisted, `actions.signal_id` stays `NULL` and the originating signal's id/value is folded into the action's `notes` text, same as the original engine did.
- **AI chat is keyword-routed, not an LLM call** — matching the pre-existing design exactly (`app/api/ai/chat/route.ts` never called a real model either). Each of the four tools (`get_school_overview`, `get_attendance_risks`, `get_outstanding_balances`, `draft_parent_message`) is permission-checked individually and grounds its answer in a real query against the live data. `draft_parent_message` used to fall back to a hardcoded fake student name ("Femi Williams") when it couldn't parse one from the prompt; it now falls back to the neutral "the student" instead of fabricating an identity.

## Routes Added

- `GET/POST /api/v1/announcements`
- `GET /api/v1/intelligence/signals`, `GET /api/v1/intelligence/health`
- `GET/POST /api/v1/actions`, `PATCH /api/v1/actions/:actionId`
- `POST /api/v1/ai/chat`

## Frontend

`app/communication`, `app/intelligence`, `app/actions`, `app/ai`, and `app/dashboard` now call `lib/api/{communication,intelligence,actions,ai}.ts`. The legacy `app/api/ai/chat/route.ts`, `modules/intelligence/engine.ts`, `modules/ai/tools.ts`, and `modules/tenancy/tenant-guard.ts` (frontend-side) were deleted once nothing imported them anymore — along with `lib/db/mock-db.ts` and `lib/auth/mock-data.ts` themselves, since every page had by then been moved off mock data.

## Verification

Live-tested end to end via a scripted Playwright run covering every module in one session (register → people → attendance → academics → finance → payments → communication → intelligence → actions → AI → dashboard → settings) with zero client-side JS errors. Also verified signal detection directly: created a student with a genuinely low attendance rate and an overdue invoice, confirmed both signals appeared with correct severities and the health score recalculated accordingly.
