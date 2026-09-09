# Testing Strategy

## Unit
Domain calculations, grading, fee totals, balance calculations, risk rules, permission helpers.

## Integration
Database operations, RLS, authentication, invoices, payment verification, webhooks, notification jobs, AI tools.

## E2E
- Owner onboarding
- Staff invitation
- Student enrollment
- Teacher attendance
- Teacher result entry
- Invoice creation
- Parent payment
- Webhook processing
- Receipt generation
- Action Center
- AI question/tool answer
- Role restrictions
- Cross-tenant access denial

## AI evaluation
Test groundedness, authorization, tool selection, refusal of unsupported actions, prompt injection resistance and numerical accuracy.

## Quality gate
Before a phase is complete:
typecheck + lint + unit tests + integration tests relevant to phase + build + E2E smoke path where applicable.
