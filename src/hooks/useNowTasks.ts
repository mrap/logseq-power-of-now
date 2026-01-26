import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { getPriority, priorityOrder } from "../utils/priority";

export interface NowTask {
  uuid: string;
  content: string;
  pageId: number;
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

    const nowTasks: NowTask[] = results.map((block: any) => ({
      uuid: block.uuid,
      content: block.content || "",
      pageId: block.page?.id || 0,
    }));

    // Sort by priority (A > B > C > none), then by elapsed time (longest first)
    nowTasks.sort(compareTasks);

    return nowTasks;
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
