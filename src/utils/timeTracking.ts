/**
 * Parses the LOGBOOK section from block content to find active clock entries.
 *
 * LOGBOOK format:
 * :LOGBOOK:
 * CLOCK: [2024-01-19 Fri 10:30]--[2024-01-19 Fri 10:45] => 00:15:00  (completed)
 * CLOCK: [2024-01-19 Fri 11:00]  (active - no end time)
 * :END:
 */

/**
 * Parse a Logseq timestamp like "[2024-01-19 Fri 10:30]" to a Date
 */
function parseLogseqTimestamp(timestamp: string): Date | null {
  // Match format: [YYYY-MM-DD Day HH:MM] or [YYYY-MM-DD Day HH:MM:SS]
  const match = timestamp.match(/\[(\d{4})-(\d{2})-(\d{2})\s+\w+\s+(\d{2}):(\d{2})(?::(\d{2}))?\]/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

/**
 * Extract the active clock start time from block content.
 * An active clock has a start time but no end time (no "--" followed by another timestamp).
 */
export function getActiveClockStartTime(content: string): Date | null {
  // Find all CLOCK entries
  // Active clock: CLOCK: [timestamp] (no "--" after it)
  // Completed clock: CLOCK: [timestamp]--[timestamp] => duration

  // Match active clocks: "CLOCK: [timestamp]" NOT followed by "--"
  const activeClockRegex = /CLOCK:\s*(\[\d{4}-\d{2}-\d{2}\s+\w+\s+\d{2}:\d{2}(?::\d{2})?\])(?!\s*--)/g;

  const matches = [...content.matchAll(activeClockRegex)];

  if (matches.length === 0) return null;

  // Return the most recent active clock (last one in the list)
  const lastMatch = matches[matches.length - 1];
  return parseLogseqTimestamp(lastMatch[1]);
}

/**
 * Get elapsed time in milliseconds from the active clock in the content.
 * Returns 0 if no active clock is found.
 */
export function getElapsedTimeFromContent(content: string): number {
  const startTime = getActiveClockStartTime(content);
  if (!startTime) return 0;

  return Date.now() - startTime.getTime();
}

/**
 * Check if the content has an active clock running
 */
export function hasActiveClock(content: string): boolean {
  return getActiveClockStartTime(content) !== null;
}
