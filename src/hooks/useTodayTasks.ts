import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { formatLogseqDate } from "../utils/dateFormat";
import { getTaskStatus, TaskStatus } from "../utils/taskUtils";
import { getPriority, priorityOrder } from "../utils/priority";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { parseScheduledDate } from "../utils/scheduling";
import { deduplicateHierarchy } from "../utils/hierarchyUtils";

export interface TodayTask {
  uuid: string;
  content: string;
  pageId: number;
  status: TaskStatus;
  isReferenced: boolean;
  createdAt?: number;
  parentUuid?: string;
  parentContent?: string;
  parentContext?: string;
}

interface BlockEntity {
  uuid: string;
  content: string;
  page?: { id: number };
  parent?: { id: number };
  children?: BlockEntity[];
  id?: number;
}

interface TodayTasksData {
  nowTasks: TodayTask[];
  todoLaterTasks: TodayTask[];
  waitingTasks: TodayTask[];
}

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
 * Flatten a block tree into an array of blocks, tracking parent info
 */
function flattenBlocks(
  blocks: BlockEntity[],
  parentUuid?: string,
  parentContent?: string
): Array<BlockEntity & { parentUuid?: string; parentContent?: string }> {
  const result: Array<BlockEntity & { parentUuid?: string; parentContent?: string }> = [];
  function traverse(block: BlockEntity, parentUuid?: string, parentContent?: string) {
    result.push({ ...block, parentUuid, parentContent });
    if (block.children) {
      for (const child of block.children) {
        traverse(child as BlockEntity, block.uuid, block.content);
      }
    }
  }
  for (const block of blocks) {
    traverse(block, parentUuid, parentContent);
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
  const fetcher = useCallback(async (): Promise<TodayTasksData> => {
    // Get user's preferred date format
    const configs = await logseq.App.getUserConfigs();
    const dateFormat = configs.preferredDateFormat || "MMM do, yyyy";

    // Format today's date to get journal page name
    const today = new Date();
    const pageName = formatLogseqDate(today, dateFormat);

    // Get blocks from today's journal page
    const pageBlocks = await logseq.Editor.getPageBlocksTree(pageName);

    if (!pageBlocks || !Array.isArray(pageBlocks)) {
      // Page might not exist yet
      return { nowTasks: [], todoLaterTasks: [], waitingTasks: [] };
    }

    // Flatten the block tree
    const flatBlocks = flattenBlocks(pageBlocks as BlockEntity[]);

    // Collect all block references from the page
    const referencedUuids = new Set<string>();
    for (const block of flatBlocks) {
      const refs = extractBlockReferences(block.content || "");
      refs.forEach((uuid) => referencedUuids.add(uuid));
    }

    // Fetch referenced blocks with their children
    const referencedBlocks: BlockEntity[] = [];
    for (const uuid of referencedUuids) {
      try {
        const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
        if (block) {
          referencedBlocks.push(block as BlockEntity);
        }
      } catch (e) {
        // Block might not exist anymore
        console.warn("[Power of NOW] Could not fetch block:", uuid);
      }
    }

    // Flatten referenced blocks to include all descendants
    const flattenedReferencedBlocks = flattenBlocks(referencedBlocks);

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
          parentUuid: block.parentUuid,
          parentContent: block.parentContent,
        });
      }
    }

    // Add referenced tasks and their descendants (won't overwrite existing)
    for (const block of flattenedReferencedBlocks) {
      const status = getTaskStatus(block.content || "");
      if (status && !taskMap.has(block.uuid)) {
        taskMap.set(block.uuid, {
          uuid: block.uuid,
          content: block.content || "",
          pageId: block.page?.id || 0,
          status,
          isReferenced: true,
          createdAt: block.id,
          parentUuid: block.parentUuid,
          parentContent: block.parentContent,
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

    // Sort and deduplicate each group separately
    return {
      nowTasks: deduplicateHierarchy(sortNowTasks(now)),
      todoLaterTasks: deduplicateHierarchy(sortTodoLaterTasks(todoLater)),
      waitingTasks: deduplicateHierarchy(sortWaitingTasks(waiting)),
    };
  }, []);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return {
    nowTasks: data?.nowTasks ?? [],
    todoLaterTasks: data?.todoLaterTasks ?? [],
    waitingTasks: data?.waitingTasks ?? [],
    loading,
    error,
    refetch,
  };
}
