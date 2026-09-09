/**
 * SchoolOS Resilient Multi-Tenant Data Store
 * Powers local development, automated testing, and seamlessly connects to Supabase in production.
 */

import {
  School,
  AcademicSession,
  Term,
  SchoolClass,
  Subject,
  Student,
  Guardian,
  Staff,
  AttendanceRecord,
  Assessment,
  Score,
  FeeStructure,
  Invoice,
  Payment,
  Receipt,
  IntelligenceSignal,
  SchoolAction,
  Announcement,
  ReportCard,
} from "@/types";
import { MOCK_PRIMARY_SCHOOL, MOCK_SECONDARY_SCHOOL } from "../auth/mock-data";
import { assertTenantAccess, SecurityContext } from "@/modules/tenancy/tenant-guard";

// In-Memory Multi-Tenant Store
class SchoolOSDatabase {
  private schools: School[] = [MOCK_PRIMARY_SCHOOL, MOCK_SECONDARY_SCHOOL];

  private sessions: AcademicSession[] = [
    {
      id: "ses_2026_2027",
      schoolId: "sch_emerald_crest_001",
      name: "2026/2027 Academic Session",
      startDate: "2026-09-01",
      endDate: "2027-07-20",
      isCurrent: true,
    },
    {
      id: "ses_gf_2026",
      schoolId: "sch_gracefield_002",
      name: "2026/2027 Session",
      startDate: "2026-09-01",
      endDate: "2027-07-20",
      isCurrent: true,
    },
  ];

  private terms: Term[] = [
    {
      id: "trm_first_2026",
      schoolId: "sch_emerald_crest_001",
      sessionId: "ses_2026_2027",
      name: "First Term",
      startDate: "2026-09-15",
      endDate: "2026-12-18",
      isCurrent: true,
    },
    {
      id: "trm_second_2027",
      schoolId: "sch_emerald_crest_001",
      sessionId: "ses_2026_2027",
      name: "Second Term",
      startDate: "2027-01-11",
      endDate: "2027-04-08",
      isCurrent: false,
    },
    {
      id: "trm_third_2027",
      schoolId: "sch_emerald_crest_001",
      sessionId: "ses_2026_2027",
      name: "Third Term",
      startDate: "2027-05-03",
      endDate: "2027-07-23",
      isCurrent: false,
    },
  ];

  private classes: SchoolClass[] = [
    {
      id: "cls_jss1_gold",
      schoolId: "sch_emerald_crest_001",
      name: "JSS 1 Gold",
      gradeLevel: "JSS 1",
      capacity: 35,
      classTeacherId: "usr_teacher_04",
      classTeacherName: "Mr. Ibrahim Musa",
    },
    {
      id: "cls_jss2_silver",
      schoolId: "sch_emerald_crest_001",
      name: "JSS 2 Silver",
      gradeLevel: "JSS 2",
      capacity: 35,
    },
    {
      id: "cls_ss2_sci",
      schoolId: "sch_emerald_crest_001",
      name: "SS 2 Science A",
      gradeLevel: "SS 2",
      capacity: 30,
    },
    {
      id: "cls_pri4_blue",
      schoolId: "sch_emerald_crest_001",
      name: "Primary 4 Blue",
      gradeLevel: "Primary 4",
      capacity: 25,
    },
    // School B Class
    {
      id: "cls_gf_ss3",
      schoolId: "sch_gracefield_002",
      name: "SS 3 Commercial",
      gradeLevel: "SS 3",
      capacity: 25,
    },
  ];

  private subjects: Subject[] = [
    { id: "sbj_mth", schoolId: "sch_emerald_crest_001", name: "Mathematics", code: "MTH" },
    { id: "sbj_eng", schoolId: "sch_emerald_crest_001", name: "English Language", code: "ENG" },
    { id: "sbj_bsc", schoolId: "sch_emerald_crest_001", name: "Basic Science & Technology", code: "BST" },
    { id: "sbj_eco", schoolId: "sch_emerald_crest_001", name: "Economics", code: "ECO" },
    { id: "sbj_cve", schoolId: "sch_emerald_crest_001", name: "Civic Education", code: "CVE" },
  ];

  private guardians: Guardian[] = [
    {
      id: "grd_tunde_williams",
      schoolId: "sch_emerald_crest_001",
      userId: "usr_parent_05",
      firstName: "Tunde",
      lastName: "Williams",
      relationship: "father",
      phone: "+234 803 555 5500",
      email: "tunde.williams@gmail.com",
      address: "Plot 8, Admiralty Road, Lekki Phase 1, Lagos",
      occupation: "Petroleum Engineer",
    },
    {
      id: "grd_nkiru_eze",
      schoolId: "sch_emerald_crest_001",
      firstName: "Nkiru",
      lastName: "Eze",
      relationship: "mother",
      phone: "+234 802 333 4455",
      email: "dr.nkiru.eze@consultant.ng",
      address: "12 Bourdillon Road, Ikoyi, Lagos",
      occupation: "Medical Doctor",
    },
    // Gracefield Guardian
    {
      id: "grd_gf_ade",
      schoolId: "sch_gracefield_002",
      firstName: "Kayode",
      lastName: "Ade",
      relationship: "father",
      phone: "+234 809 111 2233",
      email: "kayode.ade@gracefieldparent.ng",
    },
  ];

  private students: Student[] = [
    {
      id: "std_femi_01",
      schoolId: "sch_emerald_crest_001",
      admissionNumber: "ECA/2026/001",
      firstName: "Femi",
      lastName: "Williams",
      gender: "male",
      dateOfBirth: "2013-05-14",
      currentClassId: "cls_jss1_gold",
      currentClassName: "JSS 1 Gold",
      guardianId: "grd_tunde_williams",
      guardianName: "Engr. Tunde Williams",
      guardianPhone: "+234 803 555 5500",
      guardianEmail: "tunde.williams@gmail.com",
      enrollmentStatus: "active",
      enrolledDate: "2026-09-01",
    },
    {
      id: "std_folake_02",
      schoolId: "sch_emerald_crest_001",
      admissionNumber: "ECA/2026/002",
      firstName: "Folake",
      lastName: "Williams",
      gender: "female",
      dateOfBirth: "2015-09-22",
      currentClassId: "cls_pri4_blue",
      currentClassName: "Primary 4 Blue",
      guardianId: "grd_tunde_williams",
      guardianName: "Engr. Tunde Williams",
      guardianPhone: "+234 803 555 5500",
      guardianEmail: "tunde.williams@gmail.com",
      enrollmentStatus: "active",
      enrolledDate: "2026-09-01",
    },
    {
      id: "std_chioma_03",
      schoolId: "sch_emerald_crest_001",
      admissionNumber: "ECA/2026/003",
      firstName: "Chioma",
      lastName: "Eze",
      gender: "female",
      dateOfBirth: "2013-08-10",
      currentClassId: "cls_jss1_gold",
      currentClassName: "JSS 1 Gold",
      guardianId: "grd_nkiru_eze",
      guardianName: "Dr. Mrs. Nkiru Eze",
      guardianPhone: "+234 802 333 4455",
      guardianEmail: "dr.nkiru.eze@consultant.ng",
      enrollmentStatus: "active",
      enrolledDate: "2026-09-01",
    },
    {
      id: "std_zainab_04",
      schoolId: "sch_emerald_crest_001",
      admissionNumber: "ECA/2026/004",
      firstName: "Zainab",
      lastName: "Danjuma",
      gender: "female",
      dateOfBirth: "2010-02-18",
      currentClassId: "cls_ss2_sci",
      currentClassName: "SS 2 Science A",
      enrollmentStatus: "active",
      enrolledDate: "2026-09-01",
    },
    // School B Student (Tenant isolation verification)
    {
      id: "std_gf_kemi_05",
      schoolId: "sch_gracefield_002",
      admissionNumber: "GGS/2026/088",
      firstName: "Kemi",
      lastName: "Ade",
      gender: "female",
      dateOfBirth: "2009-11-04",
      currentClassId: "cls_gf_ss3",
      currentClassName: "SS 3 Commercial",
      guardianId: "grd_gf_ade",
      guardianName: "Kayode Ade",
      enrollmentStatus: "active",
      enrolledDate: "2026-09-01",
    },
  ];

  private staff: Staff[] = [
    {
      id: "stf_ibrahim_musa",
      schoolId: "sch_emerald_crest_001",
      userId: "usr_teacher_04",
      employeeId: "EMP-ECA-014",
      firstName: "Ibrahim",
      lastName: "Musa",
      email: "i.musa.maths@emeraldcrest.sch.ng",
      phone: "+234 803 555 4400",
      role: "teacher",
      title: "Senior Mathematics Master & JSS 1 Form Tutor",
      assignedClassIds: ["cls_jss1_gold", "cls_jss2_silver"],
      assignedSubjectIds: ["sbj_mth"],
      isActive: true,
      hireDate: "2022-09-01",
    },
    {
      id: "stf_chidi_okonkwo",
      schoolId: "sch_emerald_crest_001",
      userId: "usr_bursar_03",
      employeeId: "EMP-ECA-003",
      firstName: "Chidi",
      lastName: "Okonkwo",
      email: "c.okonkwo.accounts@emeraldcrest.sch.ng",
      phone: "+234 803 555 3300",
      role: "bursar",
      title: "Chief Bursar & Head of Finance",
      assignedClassIds: [],
      assignedSubjectIds: [],
      isActive: true,
      hireDate: "2020-01-15",
    },
  ];

  private attendance: AttendanceRecord[] = [
    {
      id: "att_001",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      studentId: "std_femi_01",
      date: "2026-09-08",
      status: "PRESENT",
      markedByUserId: "usr_teacher_04",
      createdAt: "2026-09-08T08:15:00Z",
    },
    {
      id: "att_002",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      studentId: "std_chioma_03",
      date: "2026-09-08",
      status: "ABSENT",
      markedByUserId: "usr_teacher_04",
      notes: "Unexplained absence",
      createdAt: "2026-09-08T08:15:00Z",
    },
    {
      id: "att_003",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      studentId: "std_chioma_03",
      date: "2026-09-07",
      status: "ABSENT",
      markedByUserId: "usr_teacher_04",
      createdAt: "2026-09-07T08:15:00Z",
    },
    {
      id: "att_004",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      studentId: "std_femi_01",
      date: "2026-09-07",
      status: "PRESENT",
      markedByUserId: "usr_teacher_04",
      createdAt: "2026-09-07T08:15:00Z",
    },
  ];

  private assessments: Assessment[] = [
    {
      id: "asm_mth_ca1",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      subjectId: "sbj_mth",
      termId: "trm_first_2026",
      name: "1st Continuous Assessment (CA1)",
      type: "CA1",
      maxScore: 20,
      weightPercentage: 20,
    },
    {
      id: "asm_mth_exam",
      schoolId: "sch_emerald_crest_001",
      classId: "cls_jss1_gold",
      subjectId: "sbj_mth",
      termId: "trm_first_2026",
      name: "First Term Examination",
      type: "EXAM",
      maxScore: 60,
      weightPercentage: 60,
    },
  ];

  private scores: Score[] = [
    {
      id: "scr_01",
      schoolId: "sch_emerald_crest_001",
      assessmentId: "asm_mth_ca1",
      studentId: "std_femi_01",
      scoreObtained: 18,
      enteredByUserId: "usr_teacher_04",
      createdAt: "2026-09-05T10:00:00Z",
      updatedAt: "2026-09-05T10:00:00Z",
    },
    {
      id: "scr_02",
      schoolId: "sch_emerald_crest_001",
      assessmentId: "asm_mth_ca1",
      studentId: "std_chioma_03",
      scoreObtained: 14,
      enteredByUserId: "usr_teacher_04",
      createdAt: "2026-09-05T10:00:00Z",
      updatedAt: "2026-09-05T10:00:00Z",
    },
  ];

  private feeStructures: FeeStructure[] = [
    {
      id: "fee_jss1_t1",
      schoolId: "sch_emerald_crest_001",
      termId: "trm_first_2026",
      termName: "First Term 2026/2027",
      classGradeLevel: "JSS 1",
      title: "JSS 1 Standard Termly Bill",
      items: [
        { id: "fi_1", name: "Tuition & Instruction", amount: 125000, category: "compulsory" },
        { id: "fi_2", name: "Science Lab & STEM / Robotics", amount: 25000, category: "compulsory" },
        { id: "fi_3", name: "Textbooks, Stationery & Workbooks", amount: 20000, category: "compulsory" },
        { id: "fi_4", name: "PTA Development Levy", amount: 15000, category: "compulsory" },
      ],
      totalAmount: 185000,
      dueDate: "2026-09-30",
    },
  ];

  private invoices: Invoice[] = [
    {
      id: "inv_2026_001",
      schoolId: "sch_emerald_crest_001",
      invoiceNumber: "INV-2026-001",
      studentId: "std_femi_01",
      studentName: "Femi Williams",
      guardianId: "grd_tunde_williams",
      guardianName: "Engr. Tunde Williams",
      guardianEmail: "tunde.williams@gmail.com",
      guardianPhone: "+234 803 555 5500",
      termId: "trm_first_2026",
      termName: "First Term 2026/2027",
      items: [
        { id: "it_1", description: "Tuition & Instruction", amount: 125000 },
        { id: "it_2", description: "Science Lab & STEM", amount: 25000 },
        { id: "it_3", description: "Textbooks & Stationery", amount: 20000 },
        { id: "it_4", description: "PTA Levy", amount: 15000 },
      ],
      totalAmount: 185000,
      amountPaid: 0,
      balanceDue: 185000,
      status: "OVERDUE",
      dueDate: "2026-09-01",
      issuedAt: "2026-08-15T09:00:00Z",
    },
    {
      id: "inv_2026_002",
      schoolId: "sch_emerald_crest_001",
      invoiceNumber: "INV-2026-002",
      studentId: "std_folake_02",
      studentName: "Folake Williams",
      guardianId: "grd_tunde_williams",
      guardianName: "Engr. Tunde Williams",
      guardianEmail: "tunde.williams@gmail.com",
      guardianPhone: "+234 803 555 5500",
      termId: "trm_first_2026",
      termName: "First Term 2026/2027",
      items: [
        { id: "it_5", description: "Primary 4 Tuition", amount: 110000 },
        { id: "it_6", description: "Books & Workbooks", amount: 25000 },
        { id: "it_7", description: "PTA Levy", amount: 15000 },
      ],
      totalAmount: 150000,
      amountPaid: 150000,
      balanceDue: 0,
      status: "PAID",
      dueDate: "2026-09-01",
      issuedAt: "2026-08-15T09:00:00Z",
    },
    // School B Invoice for tenant test
    {
      id: "inv_gf_001",
      schoolId: "sch_gracefield_002",
      invoiceNumber: "GGS-INV-001",
      studentId: "std_gf_kemi_05",
      studentName: "Kemi Ade",
      guardianId: "grd_gf_ade",
      guardianName: "Kayode Ade",
      guardianEmail: "kayode.ade@gracefieldparent.ng",
      guardianPhone: "+234 809 111 2233",
      termId: "trm_first_2026",
      termName: "First Term 2026/2027",
      items: [{ id: "it_gf_1", description: "SS 3 Commercial Tuition", amount: 210000 }],
      totalAmount: 210000,
      amountPaid: 0,
      balanceDue: 210000,
      status: "ISSUED",
      dueDate: "2026-09-30",
      issuedAt: "2026-08-20T09:00:00Z",
    },
  ];

  private payments: Payment[] = [
    {
      id: "pay_001",
      schoolId: "sch_emerald_crest_001",
      invoiceId: "inv_2026_002",
      receiptNumber: "RCT-ECA-2026-0001",
      amount: 150000,
      provider: "paystack",
      providerReference: "pstk_ref_998182711",
      paymentMethod: "paystack",
      status: "VERIFIED_SUCCESS",
      paidAt: "2026-08-25T14:32:00Z",
      payerName: "Engr. Tunde Williams",
      payerEmail: "tunde.williams@gmail.com",
      verifiedAt: "2026-08-25T14:32:15Z",
      idempotencyKey: "idemp_pstk_998182711",
    },
  ];

  private receipts: Receipt[] = [
    {
      id: "rct_001",
      schoolId: "sch_emerald_crest_001",
      receiptNumber: "RCT-ECA-2026-0001",
      paymentId: "pay_001",
      invoiceId: "inv_2026_002",
      studentName: "Folake Williams",
      admissionNumber: "ECA/2026/002",
      amountPaid: 150000,
      remainingBalance: 0,
      paymentDate: "2026-08-25T14:32:00Z",
      paymentMethod: "paystack",
      receivedBy: "Paystack Automated Gateway",
    },
  ];

  private signals: IntelligenceSignal[] = [
    {
      id: "sig_001",
      schoolId: "sch_emerald_crest_001",
      type: "LOW_ATTENDANCE",
      title: "Critical Attendance Drop Detected",
      description: "Chioma Eze (JSS 1 Gold) has 50% attendance over the last 10 school sessions.",
      severity: "high",
      metricValue: "50% Attendance Rate",
      threshold: "Threshold < 75%",
      studentId: "std_chioma_03",
      studentName: "Chioma Eze",
      classId: "cls_jss1_gold",
      className: "JSS 1 Gold",
      evidence: {
        totalDays: 10,
        daysPresent: 5,
        consecutiveDaysAbsent: 2,
        lastMarkedDate: "2026-09-08",
      },
      detectedAt: "2026-09-08T09:00:00Z",
      actionCreated: true,
      actionId: "act_001",
    },
    {
      id: "sig_002",
      schoolId: "sch_emerald_crest_001",
      type: "OVERDUE_FEES",
      title: "Unsettled First Term Bill",
      description: "Femi Williams has an outstanding balance of ₦185,000 overdue by 8 days.",
      severity: "critical",
      metricValue: "₦185,000 Overdue",
      threshold: "Due date 2026-09-01 exceeded",
      studentId: "std_femi_01",
      studentName: "Femi Williams",
      classId: "cls_jss1_gold",
      className: "JSS 1 Gold",
      evidence: {
        invoiceId: "inv_2026_001",
        invoiceAmount: 185000,
        daysOverdue: 8,
        guardianName: "Engr. Tunde Williams",
        guardianPhone: "+234 803 555 5500",
      },
      detectedAt: "2026-09-08T09:00:00Z",
      actionCreated: true,
      actionId: "act_002",
    },
    {
      id: "sig_003",
      schoolId: "sch_emerald_crest_001",
      type: "MISSING_TEACHER_SUBMISSIONS",
      title: "SS 2 Science Continuous Assessment Pending",
      description: "Biology CA1 marks have not been uploaded by the deadline.",
      severity: "medium",
      metricValue: "3 days past submission deadline",
      threshold: "Deadline: 2026-09-05",
      classId: "cls_ss2_sci",
      className: "SS 2 Science A",
      evidence: {
        subject: "Biology",
        submissionDeadline: "2026-09-05",
      },
      detectedAt: "2026-09-08T09:00:00Z",
      actionCreated: false,
    },
  ];

  private actions: SchoolAction[] = [
    {
      id: "act_001",
      schoolId: "sch_emerald_crest_001",
      signalId: "sig_001",
      title: "Contact Guardian Regarding Low Attendance",
      recommendedStep: "Place telephone call to Dr. Mrs. Nkiru Eze (+234 802 333 4455) to verify welfare status.",
      priority: "P0",
      assignedToUserId: "usr_teacher_04",
      assignedToName: "Mr. Ibrahim Musa",
      status: "OPEN",
      notes: "Follow up before Friday assembly.",
      createdAt: "2026-09-08T09:30:00Z",
    },
    {
      id: "act_002",
      schoolId: "sch_emerald_crest_001",
      signalId: "sig_002",
      title: "Issue Automated Fee Reminder via WhatsApp/SMS",
      recommendedStep: "Dispatch polite reminder with Paystack one-click payment link to Engr. Tunde Williams.",
      priority: "P0",
      assignedToUserId: "usr_bursar_03",
      assignedToName: "Mr. Chidi Okonkwo",
      status: "OPEN",
      notes: "First notice before mid-term fee enforcement.",
      createdAt: "2026-09-08T09:35:00Z",
    },
  ];

  private announcements: Announcement[] = [
    {
      id: "anc_001",
      schoolId: "sch_emerald_crest_001",
      title: "Welcome to First Term 2026/2027 Academic Session",
      body: "Dear Parents and Guardians, we welcome all returning and new scholars to Emerald Crest Academy. School opens promptly at 7:45 AM daily.",
      channels: ["whatsapp", "sms", "in_app"],
      targetAudience: "all",
      status: "SENT",
      sentAt: "2026-09-01T08:00:00Z",
      recipientCount: 340,
      deliveryStats: {
        delivered: 338,
        failed: 2,
        pending: 0,
      },
    },
  ];

  // -------------------------------------------------------------
  // SECURE TENANT-SCOPED REPOSITORY APIS
  // -------------------------------------------------------------

  getSchools(): School[] {
    return this.schools;
  }

  getSchool(id: string): School | undefined {
    return this.schools.find((s) => s.id === id);
  }

  getSessions(ctx: SecurityContext): AcademicSession[] {
    return this.sessions.filter((s) => s.schoolId === ctx.userSchoolId);
  }

  getTerms(ctx: SecurityContext): Term[] {
    return this.terms.filter((t) => t.schoolId === ctx.userSchoolId);
  }

  getClasses(ctx: SecurityContext): SchoolClass[] {
    return this.classes.filter((c) => c.schoolId === ctx.userSchoolId);
  }

  addClass(ctx: SecurityContext, data: Omit<SchoolClass, "id" | "schoolId">): SchoolClass {
    const newClass: SchoolClass = {
      ...data,
      id: `cls_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.classes.push(newClass);
    return newClass;
  }

  getSubjects(ctx: SecurityContext): Subject[] {
    return this.subjects.filter((s) => s.schoolId === ctx.userSchoolId);
  }

  addSubject(ctx: SecurityContext, data: Omit<Subject, "id" | "schoolId">): Subject {
    const newSubject: Subject = {
      ...data,
      id: `sbj_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.subjects.push(newSubject);
    return newSubject;
  }

  getStudents(ctx: SecurityContext, filterClassId?: string): Student[] {
    return this.students.filter((s) => {
      if (s.schoolId !== ctx.userSchoolId) return false;
      if (filterClassId && s.currentClassId !== filterClassId) return false;
      return true;
    });
  }

  getStudent(ctx: SecurityContext, studentId: string): Student | undefined {
    const student = this.students.find((s) => s.id === studentId);
    if (student) {
      assertTenantAccess(ctx, student.schoolId);
    }
    return student;
  }

  addStudent(ctx: SecurityContext, data: Omit<Student, "id" | "schoolId">): Student {
    const newStudent: Student = {
      ...data,
      id: `std_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.students.push(newStudent);
    return newStudent;
  }

  getStaff(ctx: SecurityContext): Staff[] {
    return this.staff.filter((s) => s.schoolId === ctx.userSchoolId);
  }

  addStaff(ctx: SecurityContext, data: Omit<Staff, "id" | "schoolId">): Staff {
    const newStaff: Staff = {
      ...data,
      id: `stf_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.staff.push(newStaff);
    return newStaff;
  }

  getAttendance(ctx: SecurityContext, classId: string, date: string): AttendanceRecord[] {
    return this.attendance.filter(
      (a) => a.schoolId === ctx.userSchoolId && a.classId === classId && a.date === date
    );
  }

  markAttendance(
    ctx: SecurityContext,
    records: Array<{ studentId: string; classId: string; date: string; status: AttendanceRecord["status"]; notes?: string }>
  ): AttendanceRecord[] {
    const updated: AttendanceRecord[] = [];
    for (const r of records) {
      const existingIdx = this.attendance.findIndex(
        (a) =>
          a.schoolId === ctx.userSchoolId &&
          a.classId === r.classId &&
          a.studentId === r.studentId &&
          a.date === r.date
      );

      const record: AttendanceRecord = {
        id: existingIdx >= 0 ? this.attendance[existingIdx].id : `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: ctx.userSchoolId,
        classId: r.classId,
        studentId: r.studentId,
        date: r.date,
        status: r.status,
        markedByUserId: ctx.userId,
        notes: r.notes,
        createdAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.attendance[existingIdx] = record;
      } else {
        this.attendance.push(record);
      }
      updated.push(record);
    }
    return updated;
  }

  getAssessments(ctx: SecurityContext, classId?: string): Assessment[] {
    return this.assessments.filter((a) => {
      if (a.schoolId !== ctx.userSchoolId) return false;
      if (classId && a.classId !== classId) return false;
      return true;
    });
  }

  addAssessment(ctx: SecurityContext, data: Omit<Assessment, "id" | "schoolId">): Assessment {
    const newAsm: Assessment = {
      ...data,
      id: `asm_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.assessments.push(newAsm);
    return newAsm;
  }

  getScores(ctx: SecurityContext, assessmentId: string): Score[] {
    return this.scores.filter((s) => s.schoolId === ctx.userSchoolId && s.assessmentId === assessmentId);
  }

  recordScores(
    ctx: SecurityContext,
    scoresList: Array<{ assessmentId: string; studentId: string; scoreObtained: number }>
  ): Score[] {
    const saved: Score[] = [];
    for (const item of scoresList) {
      const idx = this.scores.findIndex(
        (s) =>
          s.schoolId === ctx.userSchoolId &&
          s.assessmentId === item.assessmentId &&
          s.studentId === item.studentId
      );

      const rec: Score = {
        id: idx >= 0 ? this.scores[idx].id : `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: ctx.userSchoolId,
        assessmentId: item.assessmentId,
        studentId: item.studentId,
        scoreObtained: item.scoreObtained,
        enteredByUserId: ctx.userId,
        createdAt: idx >= 0 ? this.scores[idx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (idx >= 0) {
        this.scores[idx] = rec;
      } else {
        this.scores.push(rec);
      }
      saved.push(rec);
    }
    return saved;
  }

  getFeeStructures(ctx: SecurityContext): FeeStructure[] {
    return this.feeStructures.filter((f) => f.schoolId === ctx.userSchoolId);
  }

  getInvoices(ctx: SecurityContext, studentId?: string): Invoice[] {
    return this.invoices.filter((i) => {
      if (i.schoolId !== ctx.userSchoolId) return false;
      if (studentId && i.studentId !== studentId) return false;
      return true;
    });
  }

  createInvoice(ctx: SecurityContext, data: Omit<Invoice, "id" | "schoolId" | "balanceDue" | "amountPaid">): Invoice {
    const inv: Invoice = {
      ...data,
      id: `inv_${Date.now()}`,
      schoolId: ctx.userSchoolId,
      amountPaid: 0,
      balanceDue: data.totalAmount,
    };
    this.invoices.push(inv);
    return inv;
  }

  getPayments(ctx: SecurityContext): Payment[] {
    return this.payments.filter((p) => p.schoolId === ctx.userSchoolId);
  }

  recordPayment(
    ctx: SecurityContext,
    paymentData: Omit<Payment, "id" | "schoolId" | "receiptNumber" | "paidAt">
  ): { payment: Payment; receipt: Receipt } {
    // Idempotency check: if reference or key exists, return existing
    const existing = this.payments.find(
      (p) =>
        p.schoolId === ctx.userSchoolId &&
        (p.providerReference === paymentData.providerReference ||
          p.idempotencyKey === paymentData.idempotencyKey)
    );
    if (existing) {
      const existingReceipt = this.receipts.find((r) => r.paymentId === existing.id)!;
      return { payment: existing, receipt: existingReceipt };
    }

    const receiptNumber = `RCT-${ctx.userSchoolId.slice(4, 7).toUpperCase()}-${new Date().getFullYear()}-${String(this.payments.length + 1).padStart(4, "0")}`;
    const paymentId = `pay_${Date.now()}`;

    const newPayment: Payment = {
      ...paymentData,
      id: paymentId,
      schoolId: ctx.userSchoolId,
      receiptNumber,
      paidAt: new Date().toISOString(),
    };
    this.payments.push(newPayment);

    // Update invoice balance
    const invoice = this.invoices.find((i) => i.id === paymentData.invoiceId);
    if (invoice) {
      invoice.amountPaid += paymentData.amount;
      invoice.balanceDue = Math.max(0, invoice.totalAmount - invoice.amountPaid);
      if (invoice.balanceDue === 0) {
        invoice.status = "PAID";
      } else {
        invoice.status = "PARTIAL";
      }
    }

    const newReceipt: Receipt = {
      id: `rct_${Date.now()}`,
      schoolId: ctx.userSchoolId,
      receiptNumber,
      paymentId,
      invoiceId: paymentData.invoiceId,
      studentName: invoice?.studentName || "Enrolled Student",
      admissionNumber: "ECA/2026/001",
      amountPaid: paymentData.amount,
      remainingBalance: invoice?.balanceDue || 0,
      paymentDate: newPayment.paidAt,
      paymentMethod: paymentData.paymentMethod,
      receivedBy: "SchoolOS Paystack Gateway",
    };
    this.receipts.push(newReceipt);

    return { payment: newPayment, receipt: newReceipt };
  }

  getReceipts(ctx: SecurityContext): Receipt[] {
    return this.receipts.filter((r) => r.schoolId === ctx.userSchoolId);
  }

  getSignals(ctx: SecurityContext): IntelligenceSignal[] {
    return this.signals.filter((s) => s.schoolId === ctx.userSchoolId);
  }

  getActions(ctx: SecurityContext): SchoolAction[] {
    return this.actions.filter((a) => a.schoolId === ctx.userSchoolId);
  }

  createAction(ctx: SecurityContext, data: Omit<SchoolAction, "id" | "schoolId" | "createdAt">): SchoolAction {
    const act: SchoolAction = {
      ...data,
      id: `act_${Date.now()}`,
      schoolId: ctx.userSchoolId,
      createdAt: new Date().toISOString(),
    };
    this.actions.push(act);
    return act;
  }

  updateActionStatus(ctx: SecurityContext, actionId: string, status: SchoolAction["status"], outcome?: string): SchoolAction | undefined {
    const act = this.actions.find((a) => a.id === actionId && a.schoolId === ctx.userSchoolId);
    if (act) {
      act.status = status;
      if (outcome) act.outcome = outcome;
      if (status === "RESOLVED") act.resolvedAt = new Date().toISOString();
    }
    return act;
  }

  getAnnouncements(ctx: SecurityContext): Announcement[] {
    return this.announcements.filter((a) => a.schoolId === ctx.userSchoolId);
  }

  createAnnouncement(ctx: SecurityContext, data: Omit<Announcement, "id" | "schoolId">): Announcement {
    const anc: Announcement = {
      ...data,
      id: `anc_${Date.now()}`,
      schoolId: ctx.userSchoolId,
    };
    this.announcements.push(anc);
    return anc;
  }
}

export const db = new SchoolOSDatabase();
