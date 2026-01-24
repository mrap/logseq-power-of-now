import { useState, useEffect, useCallback } from "react";
import {
  SnoozeInfo,
  getSnoozeInfo,
  isResurfaced,
  getSnoozeDisplayText,
  getSnoozedAtDisplayText,
} from "../utils/snooze";

export interface SnoozedTask {
  uuid: string;
  content: string;
  pageId: number;
  snoozeUntil: Date;
  snoozedAt: Date;
  isResurfaced: boolean;
  snoozeDisplayText: string;
  snoozedAtDisplayText: string;
}

const POLL_INTERVAL = 10000; // 10 seconds

/**
 * Hook that queries and polls for snoozed tasks from Logseq.
 * Separates tasks into resurfaced (snooze expired) and pending (still snoozed).
 */
export function useSnoozedTasks() {
  const [tasks, setTasks] = useState<SnoozedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnoozedTasks = useCallback(async () => {
    try {
      // Query blocks with snoozed-until property
      const results = await logseq.DB.q("(property snoozed-until)");

      console.log("[Power of NOW] Snoozed block results:", results);

      if (!results || !Array.isArray(results)) {
        setTasks([]);
        return;
      }

      const snoozedTasks: SnoozedTask[] = [];

      for (const block of results) {
        const snoozeInfo = getSnoozeInfo({
          uuid: block.uuid,
          content: block.content || "",
          properties: block.properties,
        });

        if (snoozeInfo) {
          snoozedTasks.push({
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            snoozeUntil: snoozeInfo.until,
            snoozedAt: snoozeInfo.createdAt,
            isResurfaced: isResurfaced(snoozeInfo),
            snoozeDisplayText: getSnoozeDisplayText(snoozeInfo),
            snoozedAtDisplayText: getSnoozedAtDisplayText(snoozeInfo),
          });
        }
      }

      // Sort: resurfaced first (oldest resurface time first), then pending (soonest first)
      snoozedTasks.sort((a, b) => {
        // Resurfaced items come first
        if (a.isResurfaced && !b.isResurfaced) return -1;
        if (!a.isResurfaced && b.isResurfaced) return 1;

        // Within same category, sort by snoozeUntil
        // Resurfaced: oldest resurface time first (longest overdue)
        // Pending: soonest first
        return a.snoozeUntil.getTime() - b.snoozeUntil.getTime();
      });

      setTasks(snoozedTasks);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch snoozed tasks:", err);
      setError("Failed to fetch snoozed tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSnoozedTasks();

    // Set up polling
    const intervalId = setInterval(fetchSnoozedTasks, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchSnoozedTasks]);

  // Derived lists
  const resurfacedTasks = tasks.filter((t) => t.isResurfaced);
  const pendingTasks = tasks.filter((t) => !t.isResurfaced);

  return {
    tasks,
    resurfacedTasks,
    pendingTasks,
    loading,
    error,
    refetch: fetchSnoozedTasks,
  };
}
