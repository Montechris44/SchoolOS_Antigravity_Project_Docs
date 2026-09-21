export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SCHOOL_DAYS = DAYS.slice(0, 5);

/** Today as YYYY-MM-DD in the browser's local time (not UTC), so "today" matches the calendar the user sees. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
