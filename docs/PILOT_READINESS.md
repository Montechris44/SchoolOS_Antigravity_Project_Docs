# SchoolOS — Pilot Readiness & Onboarding Documentation

## 1. Executive Summary
SchoolOS is prepared for deployment to the initial cohort of 10 Nigerian private schools (100–1,500 students). This document guides proprietors, school heads, bursars, and teachers through self-service onboarding without developer intervention.

---

## 2. Self-Service Onboarding Checklist

### Step 1: School Identity & Workspace Setup
- [ ] Navigate to `/settings`.
- [ ] Enter official school name, Ministry of Education approval / registration details.
- [ ] Configure campus address (State, LGA, City, street address) and currency (NGN).
- [ ] Verify primary contact email and official telephone numbers.

### Step 2: Academic Calendar Configuration
- [ ] Navigate to `/people` → **Sessions & Terms**.
- [ ] Confirm active academic session (e.g., *2026/2027 Academic Session*).
- [ ] Set start and end dates for First Term, Second Term, and Third Term.

### Step 3: Classrooms, Cohorts & Curriculum Subjects
- [ ] Create classes (e.g. *JSS 1 Gold*, *SS 2 Science A*, *Primary 4 Blue*).
- [ ] Define classroom capacity.
- [ ] Set up curriculum subjects (Mathematics, English Language, Basic Science & Tech, Economics, Civic Education).

### Step 4: Faculty & Staff Roster
- [ ] Add teaching and administrative staff profiles.
- [ ] Assign class form tutors and subject teachers.
- [ ] Verify RBAC permissions (Owner, Admin, Bursar, Teacher).

### Step 5: Student Enrollment & Guardian Linkage
- [ ] Click **Enroll Student** on `/people`.
- [ ] Assign unique student admission number (e.g., `ECA/2026/001`).
- [ ] Enter scholar personal details and gender.
- [ ] Link primary parent/guardian with Nigerian phone number (+234 format) for WhatsApp and SMS broadcasts.

### Step 6: Fee Structure & Invoicing Setup
- [ ] Navigate to `/finance` → **Fee Structures**.
- [ ] Define termly fee items (Tuition, STEM & Robotics Lab, Textbooks/Stationery, PTA Levy).
- [ ] Issue student invoices with clear payment due dates.

### Step 7: Payment Gateway (Paystack)
- [ ] Input Paystack public and secret keys in the server environment (`PAYSTACK_SECRET_KEY`).
- [ ] Configure Webhook endpoint (`/api/payments/webhook`) in the Paystack dashboard.
- [ ] Send a test ₦100 transaction to confirm instant webhook verification and automated receipt generation.

### Step 8: Communication & Daily Operations
- [ ] Teachers take daily roll-call in under 60 seconds on `/attendance`.
- [ ] Enter continuous assessments (CA1, CA2) and terminal exam scores on `/academics`.
- [ ] Monitor real-time intelligence signals on `/intelligence` and operational tasks on `/actions`.

---

## 3. Demo Seed Data Package
Pre-loaded for demonstration and testing:
- **Primary Institution**: Emerald Crest Academy (14 Admiralty Way, Lekki Phase 1, Lagos).
- **Secondary Institution**: Gracefield Grammar School (22 Oba Akinjobi Way, GRA Ikeja, Lagos) — for multi-tenant isolation validation.
- **Roles & Personas**:
  - Proprietor: Dr. Adeleke Adebayo (`owner`)
  - Principal: Mrs. Funke Balogun (`admin`)
  - Bursar: Mr. Chidi Okonkwo (`bursar`)
  - Form Teacher: Mr. Ibrahim Musa (`teacher`)
  - Guardian: Engr. Tunde Williams (`parent`)
  - Scholar: Femi Williams (`student`)

---

## 4. Known Scope Boundaries (MVP)
The following are intentionally deferred to post-MVP versions (see `BACKLOG.md`):
- Computer-Based Testing (CBT) engine.
- Video lecture hosting and full LMS.
- Fleet GPS tracking & bus route optimization.
- Multi-currency expansion beyond Nigerian Naira (NGN).
