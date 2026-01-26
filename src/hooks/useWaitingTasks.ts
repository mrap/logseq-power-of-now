import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { parseScheduledDate } from "../utils/scheduling";

export interface WaitingTask {
  uuid: string;
  content: string;
  pageId: number;
  scheduledDate: Date | null;
}

/**
 * Compare waiting tasks for sorting:
 * - Scheduled tasks first (by date ascending, soonest first)
 * - Unscheduled tasks at the bottom
 */
function compareWaitingTasks(a: WaitingTask, b: WaitingTask): number {
  // Both have scheduled dates - sort by date ascending
  if (a.scheduledDate && b.scheduledDate) {
    return a.scheduledDate.getTime() - b.scheduledDate.getTime();
  }

  // Only a has scheduled date - a comes first
  if (a.scheduledDate && !b.scheduledDate) {
    return -1;
  }

  // Only b has scheduled date - b comes first
  if (!a.scheduledDate && b.scheduledDate) {
    return 1;
  }

  // Neither has scheduled date - maintain original order
  return 0;
}

/**
 * Hook that queries and polls for WAITING tasks from Logseq.
 * Returns tasks sorted by scheduled date (soonest first), with unscheduled at bottom.
 */
export function useWaitingTasks() {
  const fetcher = useCallback(async (): Promise<WaitingTask[]> => {
    const results = await logseq.DB.q("(task WAITING)");

    console.log("[Power of NOW] WAITING block results:", results);

    if (!results || !Array.isArray(results)) {
      return [];
    }

    const waitingTasks: WaitingTask[] = results.map((block: any) => ({
      uuid: block.uuid,
      content: block.content || "",
      pageId: block.page?.id || 0,
      scheduledDate: parseScheduledDate(block.content || ""),
    }));

    // Sort: scheduled first (by date ascending), unscheduled at bottom
    waitingTasks.sort(compareWaitingTasks);

    return waitingTasks;
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
