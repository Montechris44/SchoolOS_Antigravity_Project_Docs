# Communication Specification

## Channels
Design adapters for WhatsApp, SMS and email. Do not couple business logic to a single provider.

## Events
invoice.created
invoice.overdue
payment.successful
attendance.threshold_breached
result.published
announcement.created

## Message lifecycle
CREATED → QUEUED → SENT → DELIVERED/FAILED.

## Rules
- Respect recipient consent/opt-in and provider policies.
- Keep communication history.
- Use templates for repetitive messages.
- Do not allow AI to send unrestricted bulk messages.
- Rate-limit and retry safely.
