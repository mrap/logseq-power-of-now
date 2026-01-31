import { getPriority, priorityOrder } from "./priority";
import { getElapsedTimeFromContent } from "./timeTracking";
import { parseScheduledDate } from "./scheduling";

interface TaskWithContent {
  content: string;
}

/**
 * Compare by priority (A > B > C > none).
 * Returns negative if a has higher priority, positive if b has higher priority.
 */
export function comparePriority(a: TaskWithContent, b: TaskWithContent): number {
  return priorityOrder(getPriority(a.content)) - priorityOrder(getPriority(b.content));
}

/**
 * Compare by elapsed time (longest first).
 */
export function compareElapsedTime(a: TaskWithContent, b: TaskWithContent): number {
  return getElapsedTimeFromContent(b.content) - getElapsedTimeFromContent(a.content);
}

/**
 * NOW task sorting: priority first, then elapsed time (longest first).
 */
export function compareNowTasks<T extends TaskWithContent>(a: T, b: T): number {
  const priorityDiff = comparePriority(a, b);
  return priorityDiff !== 0 ? priorityDiff : compareElapsedTime(a, b);
}

/**
 * Compare by scheduled date (soonest first, null last).
 */
export function compareScheduledDate(a: TaskWithContent, b: TaskWithContent): number {
  const schedA = parseScheduledDate(a.content);
  const schedB = parseScheduledDate(b.content);

  if (schedA && schedB) return schedA.getTime() - schedB.getTime();
  if (schedA) return -1;
  if (schedB) return 1;
  return 0;
}

/**
 * WAITING task sorting: priority first, then scheduled date (soonest first).
 */
export function compareWaitingTasks<T extends TaskWithContent>(a: T, b: T): number {
  const priorityDiff = comparePriority(a, b);
  return priorityDiff !== 0 ? priorityDiff : compareScheduledDate(a, b);
}
