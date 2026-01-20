import { useState, useEffect, useCallback } from "react";
import { formatLogseqDate } from "../utils/dateFormat";
import { getTaskStatus, TaskStatus } from "../utils/taskUtils";
import { getPriority, priorityOrder } from "../utils/priority";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { parseScheduledDate } from "../utils/scheduling";

export interface TodayTask {
  uuid: string;
  content: string;
  pageId: number;
  status: TaskStatus;
  isReferenced: boolean;
  createdAt?: number;
}

interface BlockEntity {
  uuid: string;
  content: string;
  page?: { id: number };
  children?: BlockEntity[];
  id?: number;
}

const POLL_INTERVAL = 10000; // 10 seconds

// Regex to match ((uuid)) block references
const BLOCK_REF_REGEX = /\(\(([a-f0-9-]{36})\)\)/g;

/**
 * Extract all block reference UUIDs from content
 */
function extractBlockReferences(content: string): string[] {
  const matches = [...content.matchAll(BLOCK_REF_REGEX)];
  return matches.map((m) => m[1]);
}

/**
 * Flatten a block tree into an array of blocks
 */
function flattenBlocks(blocks: BlockEntity[]): BlockEntity[] {
  const result: BlockEntity[] = [];
  function traverse(block: BlockEntity) {
    result.push(block);
    if (block.children) {
      for (const child of block.children) {
        traverse(child as BlockEntity);
      }
    }
  }
  for (const block of blocks) {
    traverse(block);
  }
  return result;
}

/**
 * Sort NOW tasks: priority first, then elapsed time (longest first)
 */
function sortNowTasks(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff =
      priorityOrder(getPriority(a.content)) -
      priorityOrder(getPriority(b.content));
    if (priorityDiff !== 0) return priorityDiff;

    const elapsedA = getElapsedTimeFromContent(a.content);
    const elapsedB = getElapsedTimeFromContent(b.content);
    return elapsedB - elapsedA;
  });
}

/**
 * Sort TODO/LATER tasks: priority first, then created time (oldest first)
 */
function sortTodoLaterTasks(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff =
      priorityOrder(getPriority(a.content)) -
      priorityOrder(getPriority(b.content));
    if (priorityDiff !== 0) return priorityDiff;

    // Older first (smaller createdAt value)
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/**
 * Sort WAITING tasks: priority first, then scheduled date (soonest first), unscheduled at bottom
 */
function sortWaitingTasks(tasks: TodayTask[]): TodayTask[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff =
      priorityOrder(getPriority(a.content)) -
      priorityOrder(getPriority(b.content));
    if (priorityDiff !== 0) return priorityDiff;

    const schedA = parseScheduledDate(a.content);
    const schedB = parseScheduledDate(b.content);

    if (schedA && schedB) {
      return schedA.getTime() - schedB.getTime();
    }
    if (schedA) return -1;
    if (schedB) return 1;
    return 0;
  });
}

/**
 * Hook that queries today's journal page and returns tasks grouped by status
 */
export function useTodayTasks() {
  const [nowTasks, setNowTasks] = useState<TodayTask[]>([]);
  const [todoLaterTasks, setTodoLaterTasks] = useState<TodayTask[]>([]);
  const [waitingTasks, setWaitingTasks] = useState<TodayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayTasks = useCallback(async () => {
    try {
      // Get user's preferred date format
      const configs = await logseq.App.getUserConfigs();
      const dateFormat = configs.preferredDateFormat || "MMM do, yyyy";

      // Format today's date to get journal page name
      const today = new Date();
      const pageName = formatLogseqDate(today, dateFormat);

      console.log("[Power of NOW] Today's journal page:", pageName);

      // Get blocks from today's journal page
      const pageBlocks = await logseq.Editor.getPageBlocksTree(pageName);

      if (!pageBlocks || !Array.isArray(pageBlocks)) {
        // Page might not exist yet
        setNowTasks([]);
        setTodoLaterTasks([]);
        setWaitingTasks([]);
        setError(null);
        return;
      }

      // Flatten the block tree
      const flatBlocks = flattenBlocks(pageBlocks as BlockEntity[]);

      console.log("[Power of NOW] Found blocks on today's page:", flatBlocks.length);

      // Collect all block references from the page
      const referencedUuids = new Set<string>();
      for (const block of flatBlocks) {
        const refs = extractBlockReferences(block.content || "");
        refs.forEach((uuid) => referencedUuids.add(uuid));
      }

      console.log("[Power of NOW] Found block references:", referencedUuids.size);

      // Fetch referenced blocks
      const referencedBlocks: BlockEntity[] = [];
      for (const uuid of referencedUuids) {
        try {
          const block = await logseq.Editor.getBlock(uuid);
          if (block) {
            referencedBlocks.push(block as BlockEntity);
          }
        } catch (e) {
          // Block might not exist anymore
          console.warn("[Power of NOW] Could not fetch block:", uuid);
        }
      }

      // Build task map, deduplicating by uuid
      const taskMap = new Map<string, TodayTask>();

      // Add direct tasks from today's page
      for (const block of flatBlocks) {
        const status = getTaskStatus(block.content || "");
        if (status) {
          taskMap.set(block.uuid, {
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            status,
            isReferenced: false,
            createdAt: block.id, // EntityID often correlates with creation order
          });
        }
      }

      // Add referenced tasks (won't overwrite existing)
      for (const block of referencedBlocks) {
        const status = getTaskStatus(block.content || "");
        if (status && !taskMap.has(block.uuid)) {
          taskMap.set(block.uuid, {
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            status,
            isReferenced: true,
            createdAt: block.id,
          });
        }
      }

      // Group tasks by status
      const now: TodayTask[] = [];
      const todoLater: TodayTask[] = [];
      const waiting: TodayTask[] = [];

      for (const task of taskMap.values()) {
        switch (task.status) {
          case "NOW":
            now.push(task);
            break;
          case "TODO":
          case "LATER":
            todoLater.push(task);
            break;
          case "WAITING":
            waiting.push(task);
            break;
        }
      }

      // Sort each group
      setNowTasks(sortNowTasks(now));
      setTodoLaterTasks(sortTodoLaterTasks(todoLater));
      setWaitingTasks(sortWaitingTasks(waiting));
      setError(null);
    } catch (err) {
      console.error("Failed to fetch today's tasks:", err);
      setError("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchTodayTasks();

    // Set up polling
    const intervalId = setInterval(fetchTodayTasks, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchTodayTasks]);

  return {
    nowTasks,
    todoLaterTasks,
    waitingTasks,
    loading,
    error,
    refetch: fetchTodayTasks,
  };
}
