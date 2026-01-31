import { useCallback } from "react";
import { useTaskQuery } from "./useTaskQuery";
import { BaseTask } from "../utils/hierarchyUtils";
import { parseScheduledDate } from "../utils/scheduling";

export interface WaitingTask extends BaseTask {
  scheduledDate: Date | null;
}

/**
 * Compare waiting tasks for sorting:
 * - Scheduled tasks first (by date ascending, soonest first)
 * - Unscheduled tasks at the bottom
 */
function compareWaitingTasks(a: WaitingTask, b: WaitingTask): number {
  if (a.scheduledDate && b.scheduledDate) {
    return a.scheduledDate.getTime() - b.scheduledDate.getTime();
  }
  if (a.scheduledDate) return -1;
  if (b.scheduledDate) return 1;
  return 0;
}

/**
 * Hook that queries and polls for WAITING tasks from Logseq.
 * Returns tasks sorted by scheduled date (soonest first), with unscheduled at bottom.
 */
export function useWaitingTasks() {
  const mapper = useCallback(
    (block: { content?: string }) => ({
      scheduledDate: parseScheduledDate(block.content || ""),
    }),
    []
  );

  return useTaskQuery<WaitingTask>({
    query: "(task WAITING)",
    mapper,
    comparator: compareWaitingTasks,
  });
}
