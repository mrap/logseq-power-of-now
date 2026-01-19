import { useState, useEffect, useCallback } from "react";
import { cleanupStaleTasks } from "../utils/timeTracking";

export interface NowTask {
  uuid: string;
  content: string;
  pageId: number;
}

const POLL_INTERVAL = 10000; // 10 seconds

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

      if (!results || !Array.isArray(results)) {
        setTasks([]);
        cleanupStaleTasks([]);
        return;
      }

      const nowTasks: NowTask[] = results.map((block: any) => ({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
      }));

      setTasks(nowTasks);
      cleanupStaleTasks(nowTasks.map((t) => t.uuid));
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
