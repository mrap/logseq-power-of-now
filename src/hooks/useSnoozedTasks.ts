import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSnoozeInfo,
  isResurfaced,
  getSnoozeDisplayText,
  getSnoozedAtDisplayText,
} from "../utils/snooze";
import { getDisplayText } from "../utils/taskUtils";

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

  // Track which tasks have been notified (persists across polls)
  const notifiedUuidsRef = useRef<Set<string>>(new Set());

  // Track which tasks user has "seen" by viewing SNOOZED tab
  const [seenUuids, setSeenUuids] = useState<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

  // Show notifications for newly resurfaced tasks
  useEffect(() => {
    for (const task of resurfacedTasks) {
      if (!notifiedUuidsRef.current.has(task.uuid)) {
        const preview = getDisplayText(task.content).substring(0, 40) || "Untitled task";

        // Show Logseq toast
        logseq.UI.showMsg(`Task resurfaced: ${preview}`, "info");

        // Show native Mac notification
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Task Resurfaced", {
            body: preview,
            silent: false,
          });
        }

        notifiedUuidsRef.current.add(task.uuid);
      }
    }
  }, [resurfacedTasks]);

  // Function to mark all as seen (called when viewing SNOOZED tab)
  const markAllSeen = useCallback(() => {
    setSeenUuids(new Set(resurfacedTasks.map((t) => t.uuid)));
  }, [resurfacedTasks]);

  // Unread = resurfaced but not yet seen
  const unreadCount = resurfacedTasks.filter((t) => !seenUuids.has(t.uuid)).length;

  return {
    tasks,
    resurfacedTasks,
    pendingTasks,
    loading,
    error,
    refetch: fetchSnoozedTasks,
    unreadCount,
    markAllSeen,
  };
}
