import { useState, useEffect, useCallback } from "react";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { getPriority, priorityOrder } from "../utils/priority";

export interface NowTask {
  uuid: string;
  content: string;
  pageId: number;
}

const POLL_INTERVAL = 10000; // 10 seconds

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
  const [tasks, setTasks] = useState<NowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNowTasks = useCallback(async () => {
    try {
      const results = await logseq.DB.q("(task NOW)");

      // Log raw block data for debugging
      console.log("[Power of NOW] Raw block results:", results);

      if (!results || !Array.isArray(results)) {
        setTasks([]);
        return;
      }

      const nowTasks: NowTask[] = results.map((block: any) => ({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
      }));

      // Sort by priority (A > B > C > none), then by elapsed time (longest first)
      nowTasks.sort(compareTasks);

      setTasks(nowTasks);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch NOW tasks:", err);
      setError("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchNowTasks();

    // Set up polling
    const intervalId = setInterval(fetchNowTasks, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchNowTasks]);

  return { tasks, loading, error, refetch: fetchNowTasks };
}
