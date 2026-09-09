# SchoolOS Product Requirements Document (PRD)

## 1. Executive Summary
SchoolOS is an AI-powered operating system for Nigerian private schools. It combines school administration, academics, attendance, finance and parent communication with an intelligence layer that proactively identifies issues, recommends actions and helps authorized staff execute them.

The product is designed around the school leader's real job: understanding what is happening, knowing what requires attention, and taking action quickly.

## 2. Problem
Existing school software commonly provides modules for records, fees, attendance and results, but management still has to inspect fragmented information and manually decide what matters. SchoolOS aims to move from passive record-keeping to proactive school operations.

## 3. Product Vision
**Run your school. Know what needs attention.**

## 4. Target Customer
### Primary
Nigerian private primary/secondary schools with 100–1,500 students.

### Economic buyer
School proprietor/owner or principal with purchasing authority.

### Users
- Owner/Proprietor
- Administrator
- Bursar
- Teacher
- Parent
- Student (limited MVP scope)

## 5. Jobs To Be Done
Owner: understand school performance without asking multiple people.
Admin: run daily school operations without spreadsheets and paper.
Bursar: know who owes, what was paid, and what should be collected.
Teacher: complete attendance and assessment administration quickly.
Parent: see child information, receive updates and pay fees conveniently.

## 6. Product Principles
1. Action over information.
2. Deterministic calculations over LLM guesses.
3. Human control over consequential AI actions.
4. Mobile-first for high-frequency workflows.
5. Nigerian-localized finance, grading and communication.
6. Secure multi-tenancy from day one.
7. Build the smallest complete workflow before adding breadth.

## 7. Product Architecture
### Engine 1 — School Core
Schools, campuses, academic sessions, terms, students, guardians, staff, teachers, classes, subjects, enrollments.

### Engine 2 — Academic
Attendance, assessments, scores, grading, results, report cards and performance trends.

### Engine 3 — Finance
Fee structures, invoices, payment schedules, discounts, payments, receipts, balances and financial analytics.

### Engine 4 — Engagement
Announcements, notifications, templates, WhatsApp/SMS/email integration and event-driven communication.

### Engine 5 — Intelligence
Signals, risk scoring, school health, recommendations, Action Center and AI-assisted analysis.

## 8. MVP Functional Requirements

### FR-01 Authentication
Users can sign up, sign in, reset passwords, create a school and invite staff.

### FR-02 School Setup
Authorized users can configure school profile, academic session, terms, classes, subjects and grading settings.

### FR-03 Students
Authorized users can create/import students, maintain profiles, enroll students and associate parents/guardians.

### FR-04 Teachers and Staff
Admins can create staff records and assign teachers to classes and subjects.

### FR-05 Attendance
Teachers can mark Present, Absent, Late or Excused for assigned classes. Attendance history and summaries must update immediately.

### FR-06 Assessments and Results
Teachers can create assessments and enter scores. The system calculates grades using configured rules and produces results/report cards.

### FR-07 Finance
Authorized finance users can create fee structures and invoices, record payments, calculate balances, issue receipts and identify overdue accounts.

### FR-08 Payments
Parents can initiate online payment. Payment state becomes authoritative only after secure server-side verification/webhook processing.

### FR-09 Communication
Authorized users can create announcements and message templates. Communication events can generate notification jobs.

### FR-10 Dashboard
Owners/admins see school-level metrics and prioritized issues.

### FR-11 Intelligence Engine
The system creates deterministic signals such as low attendance, overdue invoices, declining academic performance and incomplete teacher submissions.

### FR-12 Action Center
Signals become prioritized actions with owner, status, evidence and recommended next step.

### FR-13 AI Assistant
Authorized users can ask natural-language questions. The AI must use approved server-side tools and permission checks rather than direct unrestricted database access.

### FR-14 Audit
Sensitive changes and consequential AI actions are logged.

## 9. Non-Goals for MVP
- Full LMS/video learning platform
- Payroll
- Full accounting ERP
- Transport marketplace
- Library/hostel/inventory suite
- CBT
- Native mobile apps
- AI tutor
- School website builder
- Multi-country expansion
- Unrestricted autonomous AI actions

## 10. Core User Journey
Sign up → create school → configure session/terms → add/import people → create classes → configure fees → capture attendance/results → issue invoices → parent pays → payment verified → receipt/balance updated → intelligence signals generated → Action Center → AI-assisted action → outcome measured.

## 11. UX Requirements
- Responsive and mobile-first for teachers and parents.
- Desktop-optimized management dashboard.
- Clear role-based navigation.
- Strong empty/loading/error states.
- No dead-end flows.
- Confirm destructive actions.
- Display source/evidence for important AI insights.
- Never hide critical financial or academic state behind AI.

## 12. MVP Success Criteria
The MVP is complete only when a pilot school can:
1. Create a school.
2. Add staff and students.
3. Assign students to classes.
4. Mark attendance.
5. Enter results.
6. Configure fees.
7. Create invoices.
8. Accept and verify a payment.
9. Generate a receipt and updated balance.
10. Notify parents.
11. See actionable school insights.
12. Ask the AI assistant a data-backed question.
13. Complete recommended actions.
14. Pass authorization, tenant-isolation, payment, webhook, responsive UI and E2E tests.

## 13. Metrics
North-star: **percentage of high-priority school signals that result in an appropriate completed action.**

Supporting metrics:
- Active schools
- Weekly active users
- Fee collection rate
- Recovered overdue amount
- Attendance capture rate
- Result completion rate
- Parent engagement
- Action Center completion rate
- AI queries with successful tool-grounded answers
- Retention/renewal

## 14. Pricing Hypothesis
Test:
- Starter: up to 200 students — ₦50,000/term
- Growth: up to 600 students — ₦100,000/term
- Professional: up to 1,500 students — ₦200,000/term
- Enterprise: custom
Communication/provider usage should be transparent and separately metered where applicable.

## 15. Pilot
Target 10 Nigerian private schools: 3 small, 4 medium, 3 larger. Measure operational time, collection, attendance compliance, result processing, parent engagement and management usage before/after adoption.

## 16. Definition of Done
A feature is not done because its page exists. It is done when the full workflow works end-to-end, is authorized, tenant-safe, tested, responsive, documented and buildable in production.
