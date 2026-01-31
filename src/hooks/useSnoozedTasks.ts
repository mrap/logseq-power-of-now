import { useState, useEffect, useCallback, useRef } from "react";
import { usePolling } from "./usePolling";
import {
  getSnoozeInfo,
  isResurfaced,
  getSnoozeDisplayText,
  getSnoozedAtDisplayText,
} from "../utils/snooze";
import { getDisplayText, getTaskStatus } from "../utils/taskUtils";
import { deduplicateHierarchy } from "../utils/hierarchyUtils";

export interface SnoozedTask {
  uuid: string;
  content: string;
  pageId: number;
  snoozeUntil: Date;
  snoozedAt: Date;
  isResurfaced: boolean;
  snoozeDisplayText: string;
  snoozedAtDisplayText: string;
  parentUuid?: string;
  parentContent?: string;
  parentContext?: string;
}

/**
 * Hook that queries and polls for snoozed tasks from Logseq.
 * Separates tasks into resurfaced (snooze expired) and pending (still snoozed).
 */
export function useSnoozedTasks() {
  // Track which tasks have been notified (persists across polls)
  const notifiedUuidsRef = useRef<Set<string>>(new Set());

  // Track DONE tasks for delayed cleanup
  const doneTasksRef = useRef<Map<string, { content: string; doneAt: number }>>(new Map());

  // Track which tasks user has "seen" by viewing SNOOZED tab
  const [seenUuids, setSeenUuids] = useState<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fetcher = useCallback(async (): Promise<SnoozedTask[]> => {
    // Query blocks with snoozed-until property
    const results = await logseq.DB.q("(property snoozed-until)");

    if (!results || !Array.isArray(results)) {
      return [];
    }

    const snoozedTasks: SnoozedTask[] = [];

    for (const block of results) {
      const content = block.content || "";
      const status = getTaskStatus(content);

      // Skip DONE tasks (status is null for non-active tasks)
      // Track them for delayed cleanup
      if (status === null) {
        const existing = doneTasksRef.current.get(block.uuid);
        if (!existing) {
          doneTasksRef.current.set(block.uuid, {
            content,
            doneAt: Date.now(),
          });
        }
        continue;
      }

      // Remove from done tracking if status changed back to active
      doneTasksRef.current.delete(block.uuid);

      const snoozeInfo = getSnoozeInfo({
        uuid: block.uuid,
        content,
        properties: block.properties,
      });

      if (snoozeInfo) {
        // Fetch full block to ensure we have parent info (DB.q may not include it)
        const fullBlock = await logseq.Editor.getBlock(block.uuid);
        let parentUuid: string | undefined;
        let parentContent: string | undefined;

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

        snoozedTasks.push({
          uuid: block.uuid,
          content,
          pageId: block.page?.id || 0,
          snoozeUntil: snoozeInfo.until,
          snoozedAt: snoozeInfo.createdAt,
          isResurfaced: isResurfaced(snoozeInfo),
          snoozeDisplayText: getSnoozeDisplayText(snoozeInfo),
          snoozedAtDisplayText: getSnoozedAtDisplayText(snoozeInfo),
          parentUuid,
          parentContent,
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

    // Deduplicate: hide parents when children are in the list
    return deduplicateHierarchy(snoozedTasks);
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });
  const tasks = data ?? [];

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

  // Clean up snooze properties from DONE tasks after 5 seconds
  useEffect(() => {
    const now = Date.now();
    for (const [uuid, info] of doneTasksRef.current) {
      if (now - info.doneAt >= 5000) {
        // Remove snooze properties from the block
        logseq.Editor.removeBlockProperty(uuid, "snoozed-until");
        logseq.Editor.removeBlockProperty(uuid, "snoozed-at");
        doneTasksRef.current.delete(uuid);
      }
    }
  }, [data]);

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
    refetch,
    unreadCount,
    markAllSeen,
  };
}
