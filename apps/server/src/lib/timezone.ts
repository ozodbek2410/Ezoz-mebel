/** Uzbekistan timezone utilities for server-side date handling.
 *  VPS runs in UTC, but all business logic should use Uzbekistan time (UTC+5).
 */

const UZB_TZ_OFFSET = "+05:00";
const UZB_OFFSET_MS = 5 * 60 * 60 * 1000;

/** PostgreSQL timezone name for Uzbekistan */
export const UZB_PG_TZ = "Asia/Tashkent";

/** Parse "YYYY-MM-DD" as start of day in Uzbekistan timezone (returns UTC Date) */
export function uzbStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${UZB_TZ_OFFSET}`);
}

/** Parse "YYYY-MM-DD" as end of day in Uzbekistan timezone (returns UTC Date) */
export function uzbEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${UZB_TZ_OFFSET}`);
}

/** Get current date string in Uzbekistan timezone ("YYYY-MM-DD") */
export function getUzbDateStr(d: Date = new Date()): string {
  const local = new Date(d.getTime() + UZB_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get current Date object representing start of today in Uzbekistan timezone */
export function getUzbTodayStart(): Date {
  return uzbStartOfDay(getUzbDateStr());
}

/** Get current Date object representing end of today in Uzbekistan timezone */
export function getUzbTodayEnd(): Date {
  return uzbEndOfDay(getUzbDateStr());
}
