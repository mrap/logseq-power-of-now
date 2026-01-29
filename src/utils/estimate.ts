/**
 * Utilities for task time estimate functionality.
 * Handles parsing estimate input and storing estimates as block properties.
 */

/**
 * Parse estimate input into minutes.
 *
 * Supported formats:
 * - Minutes: "30m", "30min", "30 minutes"
 * - Hours: "2h", "2hr", "2 hours", "1.5h"
 * - Days: "1d", "1 day" (assumes 8 hours per day)
 * - Combined: "1h30m", "2h15m"
 *
 * Returns null if unparseable.
 */
export function parseEstimateInput(input: string): number | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim().toLowerCase();

  // Handle combined format: "1h30m", "2h15m"
  const combinedMatch = trimmed.match(/^(\d+)\s*h\s*(\d+)\s*m$/i);
  if (combinedMatch) {
    const hours = parseInt(combinedMatch[1], 10);
    const minutes = parseInt(combinedMatch[2], 10);
    return hours * 60 + minutes;
  }

  // Handle single unit formats: "30m", "2h", "1.5h", "1d"
  const singleMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i
  );
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    const unit = singleMatch[2].toLowerCase();

    if (unit.startsWith("m")) {
      return Math.round(value);
    }
    if (unit.startsWith("h")) {
      return Math.round(value * 60);
    }
    if (unit.startsWith("d")) {
      // 1 day = 8 working hours
      return Math.round(value * 8 * 60);
    }
  }

  return null;
}

/**
 * Format minutes as a compact display string.
 *
 * Examples:
 * - 30 -> "30m"
 * - 60 -> "1h"
 * - 90 -> "1h30m"
 * - 120 -> "2h"
 * - 480 -> "1d" (8 hours)
 */
export function formatEstimate(minutes: number): string {
  if (minutes <= 0) return "0m";

  // Check if it's a clean day (multiple of 480 = 8 hours)
  if (minutes >= 480 && minutes % 480 === 0) {
    return `${minutes / 480}d`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h${mins}m`;
}

/**
 * Format minutes as a human-readable string for preview.
 *
 * Examples:
 * - 30 -> "30 minutes"
 * - 60 -> "1 hour"
 * - 90 -> "1 hour 30 minutes"
 * - 480 -> "1 day (8 hours)"
 */
export function formatEstimatePreview(minutes: number): string {
  if (minutes <= 0) return "0 minutes";

  // Check if it's a clean day
  if (minutes >= 480 && minutes % 480 === 0) {
    const days = minutes / 480;
    return days === 1 ? "1 day (8 hours)" : `${days} days (${days * 8} hours)`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(hours === 1 ? "1 hour" : `${hours} hours`);
  }
  if (mins > 0) {
    parts.push(mins === 1 ? "1 minute" : `${mins} minutes`);
  }

  return parts.join(" ");
}

/**
 * Parse estimate property value (stored as minutes number or string).
 */
export function parseEstimateProperty(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Extract estimate from block properties.
 * Returns minutes or null if not found.
 */
export function getEstimateFromBlock(properties?: Record<string, unknown>): number | null {
  if (!properties) return null;

  // Logseq converts hyphenated property names to camelCase
  const value = properties["estimatedTime"];
  return parseEstimateProperty(value);
}
