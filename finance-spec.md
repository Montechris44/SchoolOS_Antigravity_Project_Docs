# Finance Specification

## Fee structure
A fee structure belongs to a school and academic term. It contains fee items, amounts, due dates and optional rules for class/category assignment.

## Invoice
Invoice is generated for a student/guardian and contains immutable line items after issuance except through explicit adjustment workflows.

## Payment states
INITIATED → PENDING → VERIFIED_SUCCESS or FAILED/CANCELLED.

Only VERIFIED_SUCCESS affects balances.

## Paystack flow
Create transaction server-side → redirect/customer payment → provider webhook → verify webhook signature → verify transaction server-side → idempotency check → record verified payment → update invoice/balance → receipt → notify.

## Financial controls
- Never trust client success pages.
- Never expose secret keys client-side.
- Use integer minor units where provider conventions require it.
- Keep payment provider reference unique.
- Reconciliation must be traceable.
- Refunds are out of initial MVP unless a controlled workflow is implemented.
