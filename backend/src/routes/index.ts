import { FastifyInstance } from "fastify";

import { assignmentsRoutes } from "../modules/assignments/assignments.routes";
import { dashboardsRoutes } from "../modules/dashboards/dashboards.routes";
import { eventsRoutes } from "../modules/events/events.routes";
import { leaveRoutes } from "../modules/leave/leave.routes";
import { messagesRoutes } from "../modules/messages/messages.routes";
import { notificationsRoutes } from "../modules/notifications/notifications.routes";
import { parentsRoutes } from "../modules/parents/parents.routes";
import { staffAttendanceRoutes } from "../modules/staff-attendance/staff-attendance.routes";
import { timetableRoutes } from "../modules/timetable/timetable.routes";
import { academicSessionsRoutes } from "../modules/academic-sessions/academic-sessions.routes";
import { actionsRoutes } from "../modules/actions/actions.routes";
import { aiRoutes } from "../modules/ai/ai.routes";
import { announcementsRoutes } from "../modules/announcements/announcements.routes";
import { assessmentsRoutes } from "../modules/assessments/assessments.routes";
import { attendanceRoutes } from "../modules/attendance/attendance.routes";
import { authRoutes } from "../modules/auth/auth.routes";
import { classesRoutes } from "../modules/classes/classes.routes";
import { feeStructuresRoutes } from "../modules/fee-structures/fee-structures.routes";
import { gradingRoutes } from "../modules/grading/grading.routes";
import { guardiansRoutes } from "../modules/guardians/guardians.routes";
import { healthRoutes } from "../modules/health/health.routes";
import { intelligenceRoutes } from "../modules/intelligence/intelligence.routes";
import { invoicesRoutes } from "../modules/invoices/invoices.routes";
import { paymentsRoutes } from "../modules/payments/payments.routes";
import { resultsRoutes } from "../modules/results/results.routes";
import { schoolSettingsRoutes } from "../modules/school-settings/school-settings.routes";
import { schoolsRoutes } from "../modules/schools/schools.routes";
import { scoresRoutes } from "../modules/scores/scores.routes";
import { staffRoutes } from "../modules/staff/staff.routes";
import { studentsRoutes } from "../modules/students/students.routes";
import { subjectsRoutes } from "../modules/subjects/subjects.routes";
import { teacherAssignmentsRoutes } from "../modules/teacher-assignments/teacher-assignments.routes";
import { superAdminRoutes } from "../modules/super-admin/super-admin.routes";
import { termsRoutes } from "../modules/terms/terms.routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.register(healthRoutes);

  app.register(
    async (api) => {
      api.register(healthRoutes);
      api.register(authRoutes);
      api.register(schoolsRoutes);
      api.register(classesRoutes);
      api.register(subjectsRoutes);
      api.register(guardiansRoutes);
      api.register(studentsRoutes);
      api.register(staffRoutes);
      api.register(academicSessionsRoutes);
      api.register(termsRoutes);
      api.register(teacherAssignmentsRoutes);
      api.register(gradingRoutes);
      api.register(resultsRoutes);
      api.register(staffAttendanceRoutes);
      api.register(leaveRoutes);
      api.register(timetableRoutes);
      api.register(assignmentsRoutes);
      api.register(messagesRoutes);
      api.register(notificationsRoutes);
      api.register(eventsRoutes);
      api.register(dashboardsRoutes);
      api.register(parentsRoutes);
      api.register(schoolSettingsRoutes);
      api.register(attendanceRoutes);
      api.register(assessmentsRoutes);
      api.register(scoresRoutes);
      api.register(feeStructuresRoutes);
      api.register(invoicesRoutes);
      api.register(paymentsRoutes);
      api.register(announcementsRoutes);
      api.register(intelligenceRoutes);
      api.register(actionsRoutes);
      api.register(aiRoutes);
      api.register(superAdminRoutes);
    },
    { prefix: "/api/v1" }
  );
}
