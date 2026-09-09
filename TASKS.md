# SchoolOS Task Backlog

## Phase 0: Repository Audit & Baseline Setup
- [x] **SOS-001**: Audit repository, establish baseline documentation, verify dependencies and toolchain.

## Phase 1: Foundation
- [x] **SOS-002**: Initialize Next.js App Router project with TypeScript strict mode, ESLint, and baseline configuration.
- [x] **SOS-003**: Configure Tailwind CSS, design tokens, typography, and core UI component foundation.
- [x] **SOS-004**: Implement Supabase client, authentication layer, and session handling with resilient local fallback.
- [x] **SOS-005**: Build responsive App Shell, role-aware navigation bar/sidebar, and standard loading/empty/error states.

## Phase 2: Tenancy and RBAC
- [x] **SOS-006**: Create school/workspace data model, membership management, roles, and permission guards.
- [x] **SOS-007**: Define PostgreSQL/Supabase schema with Row Level Security (RLS) and automated tenant-isolation verification.

## Phase 3: People and Classes
- [x] **SOS-008**: Implement academic sessions, terms, classes, and subjects configuration.
- [x] **SOS-009**: Implement students, guardians, teacher/staff profiles, class assignments, and enrollment workflows.

## Phase 4: Attendance
- [x] **SOS-010**: Implement attendance marking workflow, daily registers, attendance history, summaries, and low-attendance triggers.

## Phase 5: Academics
- [x] **SOS-011**: Implement assessments, score entry, deterministic grade calculation engine, term results, and report cards.

## Phase 6: Finance
- [x] **SOS-012**: Implement fee structures, line items, student invoices, balance calculation, and receipt generation.

## Phase 7: Payments
- [x] **SOS-013**: Implement Paystack payment provider adapter, server-side transaction initialization, webhook verification, idempotency, and balance updates.

## Phase 8: Communication
- [x] **SOS-014**: Implement announcements, notification job queue, delivery lifecycle, and WhatsApp/SMS adapter boundaries.

## Phase 9: Management Dashboard
- [x] **SOS-015**: Build executive dashboard with authoritative KPI metric cards (finance, attendance, academic, enrollment) and priority summaries.

## Phase 10: Intelligence Engine
- [x] **SOS-016**: Implement deterministic signal rules (low attendance, overdue invoices, grade declines, missing submissions) and School Health Score calculation.

## Phase 11: Action Center
- [x] **SOS-017**: Build Action Center workflow: signal-to-action conversion, priority ranking, staff assignment, resolution tracking, and audit logging.

## Phase 12: AI Assistant
- [x] **SOS-018**: Implement AI Gateway with authenticated session context, approved server-side tools, grounded responses, and assisted action drafts.

## Phase 13: Hardening
- [x] **SOS-019**: Perform comprehensive security audit, RLS policy verification, input validation review, secret scanning, and error handling hardening.

## Phase 14: Full Validation
- [x] **SOS-020**: Run end-to-end integration tests, cross-tenant denial tests, role permission regression, and production build.

## Phase 15: Pilot Readiness
- [x] **SOS-021**: Create realistic Nigerian school demo seed data, onboarding checklist, and pilot operational documentation.
