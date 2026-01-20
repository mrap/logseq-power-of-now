const MONTHS_SHORT = [
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

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Returns ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Formats a date according to Logseq's preferredDateFormat.
 * Supports common patterns without requiring date-fns.
 *
 * Common Logseq formats:
 * - "MMM do, yyyy" → "Jan 20th, 2026"
 * - "yyyy-MM-dd" → "2026-01-20"
 * - "MM/dd/yyyy" → "01/20/2026"
 * - "dd-MM-yyyy" → "20-01-2026"
 * - "do MMM yyyy" → "20th Jan 2026"
 */
export function formatLogseqDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  // Order matters: replace longer patterns first to avoid partial matches
  return format
    .replace("yyyy", year.toString())
    .replace("yy", (year % 100).toString().padStart(2, "0"))
    .replace("MMMM", MONTHS_FULL[month])
    .replace("MMM", MONTHS_SHORT[month])
    .replace("MM", (month + 1).toString().padStart(2, "0"))
    .replace("EEEE", DAYS_FULL[dayOfWeek])
    .replace("EEE", DAYS_SHORT[dayOfWeek])
    .replace("do", getOrdinal(day))
    .replace("dd", day.toString().padStart(2, "0"))
    .replace(/\bd\b/, day.toString()); // Match standalone 'd', not 'dd'
}
