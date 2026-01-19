/**
 * Utilities for parsing and formatting SCHEDULED dates from Logseq blocks.
 *
 * SCHEDULED format: SCHEDULED: <2026-01-19 Mon 16:00>
 */

/**
 * Parse a SCHEDULED date from block content.
 * Returns null if no SCHEDULED date is found.
 */
export function parseScheduledDate(content: string): Date | null {
  // Match: SCHEDULED: <YYYY-MM-DD Day HH:MM> or SCHEDULED: <YYYY-MM-DD Day>
  const match = content.match(
    /SCHEDULED:\s*<(\d{4})-(\d{2})-(\d{2})\s+\w+(?:\s+(\d{2}):(\d{2}))?>/
  );
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0"] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute)
  );
}

/**
 * Format a date as relative time (e.g., "in 2h", "3d ago", "tomorrow").
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const isFuture = diffMs > 0;

  // Within an hour
  if (Math.abs(diffMins) < 60) {
    if (Math.abs(diffMins) <= 1) return "now";
    return isFuture ? `in ${diffMins}m` : `${Math.abs(diffMins)}m ago`;
  }

  // Within a day
  if (Math.abs(diffHours) < 24) {
    return isFuture ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }

  // Check for tomorrow/yesterday
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, tomorrow)) return "tomorrow";
  if (isSameDay(date, yesterday)) return "yesterday";
  if (isSameDay(date, now)) return "today";

  // Days
  if (Math.abs(diffDays) < 7) {
    return isFuture ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
  }

  // Weeks
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 4) {
    return isFuture ? `in ${diffWeeks}w` : `${Math.abs(diffWeeks)}w ago`;
  }

  // Months
  const diffMonths = Math.round(diffDays / 30);
  return isFuture ? `in ${diffMonths}mo` : `${Math.abs(diffMonths)}mo ago`;
}

/**
 * Format a date for tooltip display (e.g., "Jan 19 4:00pm").
 */
export function formatAbsoluteDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // If no time specified (00:00), just show date
  if (hours === 0 && minutes === 0) {
    return `${month} ${day}`;
  }

  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, "0");

  return `${month} ${day} ${displayHours}:${displayMinutes}${period}`;
}

/**
 * Check if two dates are on the same calendar day.
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
