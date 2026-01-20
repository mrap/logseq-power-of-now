export type TaskStatus = "NOW" | "TODO" | "LATER" | "WAITING";

/**
 * Extract task status from block content.
 * Returns the status or null if not a task block.
 */
export function getTaskStatus(content: string): TaskStatus | null {
  if (/^NOW\s/i.test(content)) return "NOW";
  if (/^TODO\s/i.test(content)) return "TODO";
  if (/^LATER\s/i.test(content)) return "LATER";
  if (/^WAITING\s/i.test(content)) return "WAITING";
  return null;
}

/**
 * Extracts a clean display text from block content.
 * Removes the task marker, priority, timestamps, and LOGBOOK section.
 */
export function getDisplayText(content: string): string {
  return content
    .replace(/^(NOW|TODO|LATER|WAITING)\s*/i, "") // Remove task marker
    .replace(/\[#[ABC]\]\s*/gi, "") // Remove priority marker [#A], [#B], [#C]
    .replace(/:LOGBOOK:[\s\S]*?:END:/g, "") // Remove LOGBOOK section
    .replace(/\[[\d-]+\s+\w+\s+[\d:]+\]/g, "") // Remove timestamps like [2024-01-19 Fri 10:30]
    .replace(/SCHEDULED:\s*<[^>]+>/g, "") // Remove SCHEDULED
    .replace(/DEADLINE:\s*<[^>]+>/g, "") // Remove DEADLINE
    .trim();
}
