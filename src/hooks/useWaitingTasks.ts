import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { parseScheduledDate } from "../utils/scheduling";
import { deduplicateHierarchy } from "../utils/hierarchyUtils";

export interface WaitingTask {
  uuid: string;
  content: string;
  pageId: number;
  scheduledDate: Date | null;
  parentUuid?: string;
  parentContent?: string;
  parentContext?: string;
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

    // Build tasks with parent info
    const waitingTasks: WaitingTask[] = [];
    for (const block of results as any[]) {
      // Fetch full block to ensure we have parent info (DB.q may not include it)
      const fullBlock = await logseq.Editor.getBlock(block.uuid);
      let parentUuid: string | undefined;
      let parentContent: string | undefined;

      // Get parent info if parent is a block (not a page)
      if (fullBlock?.parent?.id) {
        try {
          const parentBlock = await logseq.Editor.getBlock(fullBlock.parent.id);
          if (parentBlock) {
            parentUuid = parentBlock.uuid;
            parentContent = parentBlock.content;
          }
        } catch {
          // Parent might be a page, not a block
        }
      }

      waitingTasks.push({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
        scheduledDate: parseScheduledDate(block.content || ""),
        parentUuid,
        parentContent,
      });
    }

    // Sort: scheduled first (by date ascending), unscheduled at bottom
    waitingTasks.sort(compareWaitingTasks);

    // Deduplicate: hide parents when children are in the list
    return deduplicateHierarchy(waitingTasks);
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
