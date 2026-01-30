import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { getPriority, priorityOrder } from "../utils/priority";
import { deduplicateHierarchy, TaskWithContext } from "../utils/hierarchyUtils";

export interface NowTask {
  uuid: string;
  content: string;
  pageId: number;
  parentUuid?: string;
  parentContent?: string;
  parentContext?: string;
}

/**
 * Compare tasks for sorting: first by priority (A > B > C > none), then by elapsed time (longest first)
 */
function compareTasks(a: NowTask, b: NowTask): number {
  const priorityDiff =
    priorityOrder(getPriority(a.content)) -
    priorityOrder(getPriority(b.content));
  if (priorityDiff !== 0) return priorityDiff;

  // Secondary sort: elapsed time (longest first, so descending)
  const elapsedA = getElapsedTimeFromContent(a.content);
  const elapsedB = getElapsedTimeFromContent(b.content);
  return elapsedB - elapsedA;
}

/**
 * Hook that queries and polls for NOW tasks from Logseq
 */
export function useNowTasks() {
  const fetcher = useCallback(async (): Promise<NowTask[]> => {
    const results = await logseq.DB.q("(task NOW)");

    console.log("[Power of NOW] Raw block results:", results);

    if (!results || !Array.isArray(results)) {
      return [];
    }

    // Build tasks with parent info
    const nowTasks: NowTask[] = [];
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

      nowTasks.push({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
        parentUuid,
        parentContent,
      });
    }

    // Sort by priority (A > B > C > none), then by elapsed time (longest first)
    nowTasks.sort(compareTasks);

    // Deduplicate: hide parents when children are in the list
    return deduplicateHierarchy(nowTasks);
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
