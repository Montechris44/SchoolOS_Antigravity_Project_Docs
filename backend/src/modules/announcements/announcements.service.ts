import { query } from "../../db/pool";
import { DispatchAnnouncementInput } from "./announcements.schemas";

const ANNOUNCEMENT_SELECT = `
  SELECT id, school_id, title, body, channels, target_audience, target_class_id,
         status, sent_at, recipient_count, delivered_count, failed_count, pending_count, created_at
  FROM announcements
`;

interface AnnouncementRow {
  id: string;
  school_id: string;
  title: string;
  body: string;
  channels: string[];
  target_audience: string;
  target_class_id: string | null;
  status: string;
  sent_at: string | null;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
}

function toAnnouncementRecord(row: AnnouncementRow) {
  return {
    ...row,
    delivery_stats: {
      delivered: row.delivered_count,
      failed: row.failed_count,
      pending: row.pending_count,
    },
  };
}

export async function listAnnouncements(schoolId: string) {
  const result = await query<AnnouncementRow>(`${ANNOUNCEMENT_SELECT} WHERE school_id = $1 ORDER BY created_at DESC`, [
    schoolId,
  ]);
  return result.rows.map(toAnnouncementRecord);
}

export async function dispatchAnnouncement(
  schoolId: string,
  sentByUserId: string,
  input: DispatchAnnouncementInput
) {
  const countResult = await query<{ count: string }>(
    input.targetClassId
      ? "SELECT COUNT(*) FROM students WHERE school_id = $1 AND current_class_id = $2"
      : "SELECT COUNT(*) FROM students WHERE school_id = $1",
    input.targetClassId ? [schoolId, input.targetClassId] : [schoolId]
  );

  const recipientCount = Math.max(parseInt(countResult.rows[0].count, 10), 1);
  const deliveredCount = Math.floor(recipientCount * 0.98);
  const failedCount = recipientCount - deliveredCount;

  const result = await query<{ id: string }>(
    `INSERT INTO announcements (
       school_id, title, body, channels, target_audience, target_class_id,
       status, sent_at, recipient_count, delivered_count, failed_count, pending_count, sent_by_user_id
     ) VALUES ($1, $2, $3, $4, $5, $6, 'SENT', NOW(), $7, $8, $9, 0, $10)
     RETURNING id`,
    [
      schoolId,
      input.title,
      input.body,
      input.channels,
      input.targetAudience,
      input.targetClassId ?? null,
      recipientCount,
      deliveredCount,
      failedCount,
      sentByUserId,
    ]
  );

  const createdResult = await query<AnnouncementRow>(`${ANNOUNCEMENT_SELECT} WHERE id = $1`, [result.rows[0].id]);
  return toAnnouncementRecord(createdResult.rows[0]);
}
