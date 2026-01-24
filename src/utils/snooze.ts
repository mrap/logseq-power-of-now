/**
 * Utilities for snooze functionality.
 * Handles natural language date parsing and snooze property management.
 */

import * as chrono from "chrono-node";
import { formatRelativeDate } from "./scheduling";

/**
 * Snooze information extracted from a block's properties.
 */
export interface SnoozeInfo {
  until: Date;
  createdAt: Date;
}

/**
 * Block entity type for property access.
 * Matches Logseq's block structure.
 */
export interface BlockEntity {
  uuid: string;
  content: string;
  properties?: Record<string, unknown>;
}

/**
 * Parse natural language snooze input into a Date.
 * Uses chrono-node for parsing with custom refiners for shorthand.
 *
 * Supported formats:
 * - Minutes: "5m", "5 mins", "5 minutes", "in 5 minutes"
 * - Hours: "2h", "2 hours", "in 2 hours"
 * - Days: "2d", "2 days", "in 2 days", "tomorrow"
 * - Relative: "next week", "next Monday", "next month"
 * - Absolute: "January 5th", "Jan 5", "1/5"
 *
 * Returns null if unparseable.
 */
export function parseSnoozeInput(input: string): Date | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim().toLowerCase();

  // Handle shorthand formats that chrono-node doesn't parse well
  // e.g., "5m", "2h", "3d", "1w"
  const shorthandMatch = trimmed.match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)$/i);
  if (shorthandMatch) {
    const value = parseInt(shorthandMatch[1], 10);
    const unit = shorthandMatch[2].toLowerCase();

    const now = new Date();

    if (unit.startsWith("m")) {
      return new Date(now.getTime() + value * 60 * 1000);
    }
    if (unit.startsWith("h")) {
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    }
    if (unit.startsWith("d")) {
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }
    if (unit.startsWith("w")) {
      return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Use chrono-node for natural language parsing
  const parsed = chrono.parseDate(input);
  return parsed;
}

/**
 * Format a Date as an ISO string for Logseq property storage.
 * Example: "2026-01-25T14:00:00.000Z"
 */
export function formatSnoozeProperty(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an ISO date string from a Logseq property value.
 * Returns null if invalid.
 */
export function parseSnoozeProperty(value: unknown): Date | null {
  if (typeof value !== "string") return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Extract snooze information from a block's properties.
 * Returns null if the block is not snoozed.
 */
export function getSnoozeInfo(block: BlockEntity): SnoozeInfo | null {
  if (!block.properties) return null;

  // Logseq converts hyphenated property names to camelCase
  const untilValue = block.properties["snoozedUntil"];
  const createdAtValue = block.properties["snoozedAt"];

  const until = parseSnoozeProperty(untilValue);
  const createdAt = parseSnoozeProperty(createdAtValue);

  if (!until || !createdAt) return null;

  return { until, createdAt };
}

/**
 * Check if a snoozed task has resurfaced (snooze time has passed).
 */
export function isResurfaced(snoozeInfo: SnoozeInfo): boolean {
  return snoozeInfo.until.getTime() < Date.now();
}

/**
 * Get display text for snooze timing.
 * - If resurfaced: "Resurfaced 5m ago"
 * - If pending: "in 2h"
 */
export function getSnoozeDisplayText(snoozeInfo: SnoozeInfo): string {
  if (isResurfaced(snoozeInfo)) {
    const timeSince = formatRelativeDate(snoozeInfo.until);
    // formatRelativeDate returns "5m ago" for past dates
    return `Resurfaced ${timeSince}`;
  }

  // For pending, formatRelativeDate returns "in 2h" for future dates
  return formatRelativeDate(snoozeInfo.until);
}

/**
 * Get display text for when the snooze was created.
 * Example: "Snoozed 2h ago"
 */
export function getSnoozedAtDisplayText(snoozeInfo: SnoozeInfo): string {
  const timeSince = formatRelativeDate(snoozeInfo.createdAt);
  return `Snoozed ${timeSince}`;
}
