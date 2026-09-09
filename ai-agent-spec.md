# AI Agent Specification

## Principle
The LLM is an interface and reasoning layer, not the system of record.

## Architecture
User → AI Gateway → authentication → intent detection → permission check → approved tool → validated data → LLM response → audit.

## Initial tools
get_school_overview
search_students
get_student
get_attendance
get_attendance_risks
get_academic_performance
get_at_risk_students
get_fee_summary
get_outstanding_balances
get_payment_history
get_teacher_submission_status
draft_parent_message
create_action

## Later tools
send_parent_message
create_invoice
send_payment_reminder
publish_report_card

## Modes
READ: answer/analyze only.
ASSISTED: prepare an action; human confirms.
AUTONOMOUS: only pre-approved low-risk workflows.

## Safety
AI must never invent grades, balances, payment status, attendance or school metrics. It must retrieve authoritative data. Sensitive actions require permission checks. High-impact changes require confirmation. Prompt injection from messages or uploaded content must never override system policy.

## Evidence
Important answers should state the relevant period and data basis. Where practical, provide links/buttons to the underlying record.

## Audit
Record AI interaction metadata, selected tool, actor, action, authorization result and outcome. Do not store unnecessary sensitive prompt content.
