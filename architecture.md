# Technical Architecture

## Architecture style
Modular monolith. Keep domain boundaries clear without premature microservices.

## Stack
- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- PostgreSQL/Supabase
- Supabase Storage
- Paystack
- LLM API through an internal AI gateway
- WhatsApp/SMS provider adapters
- Vercel or equivalent deployment

## Suggested structure
```text
app/
  (auth)/
  (dashboard)/
  api/
components/
modules/
  auth/
  schools/
  people/
  academics/
  attendance/
  finance/
  communication/
  intelligence/
  ai/
  reports/
lib/
  auth/
  db/
  permissions/
  payments/
  messaging/
  ai/
  validation/
supabase/
  migrations/
tests/
workflow/
.agents/
```

## Architectural rules
- Server is authoritative for tenant identity and permissions.
- Client never chooses an arbitrary school_id for authorization.
- Domain logic belongs in modules/services, not UI components.
- Validate all external input.
- Use database constraints for invariants.
- Use idempotency for payment/webhook processing.
- Secrets stay server-side.
- AI accesses approved tools only.
- Consequential actions require permission and, initially, human confirmation.
- Use provider adapters so payment/messaging providers can be swapped.

## Event concepts
student.enrolled
attendance.marked
attendance.threshold_breached
assessment.created
result.published
invoice.created
invoice.overdue
payment.successful
payment.failed
report_card.published
communication.sent

Events may initially be implemented as transactional domain events/jobs inside the monolith.

## Reliability
- Structured logs
- Error boundaries
- Retry strategy for transient provider failures
- Idempotency keys
- Audit logs
- Health checks
