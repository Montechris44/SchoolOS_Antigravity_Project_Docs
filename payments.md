# Payments

Paystack is the initial payment provider.

## Requirements
- Server-side transaction initialization.
- Secure callback handling.
- Webhook signature validation.
- Server-side transaction verification.
- Idempotent event processing.
- Payment provider reference uniqueness.
- Reconciliation/audit trail.
- Receipt generation only after verified success.

Provider abstraction should make future Flutterwave or other integrations possible without rewriting finance domain logic.
