import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { deduplicateHierarchy } from "../utils/hierarchyUtils";
import { fetchParentInfo } from "../utils/blockUtils";
import { compareNowTasks } from "../utils/taskComparators";

export interface NowTask {
  uuid: string;
  content: string;
  pageId: number;
  parentUuid?: string;
  parentContent?: string;
  parentContext?: string;
}

/**
 * Hook that queries and polls for NOW tasks from Logseq
 */
export function useNowTasks() {
  const fetcher = useCallback(async (): Promise<NowTask[]> => {
    const results = await logseq.DB.q("(task NOW)");

    if (!results || !Array.isArray(results)) {
      return [];
    }

    // Build tasks with parent info
    const nowTasks: NowTask[] = [];
    for (const block of results as any[]) {
      const { parentUuid, parentContent } = await fetchParentInfo(block.uuid);

      nowTasks.push({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
        parentUuid,
        parentContent,
      });
    }

    // Sort by priority (A > B > C > none), then by elapsed time (longest first)
    nowTasks.sort(compareNowTasks);

    // Deduplicate: hide parents when children are in the list
    return deduplicateHierarchy(nowTasks);
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
