import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { BaseTask, deduplicateHierarchy } from "../utils/hierarchyUtils";
import { fetchParentInfo } from "../utils/blockUtils";

interface BlockResult {
  uuid: string;
  content?: string;
  page?: { id: number };
  properties?: Record<string, unknown>;
}

interface UseTaskQueryOptions<T extends BaseTask> {
  query: string;
  mapper?: (block: BlockResult) => Partial<Omit<T, keyof BaseTask>>;
  comparator: (a: T, b: T) => number;
}

// Stable default mapper - must be defined at module level to avoid re-creation
const DEFAULT_MAPPER = () => ({});

/**
 * Generic hook for querying tasks from Logseq DB.
 * Handles parent info fetching, sorting, deduplication, and polling.
 */
export function useTaskQuery<T extends BaseTask>({
  query,
  mapper = DEFAULT_MAPPER,
  comparator,
}: UseTaskQueryOptions<T>) {
  const fetcher = useCallback(async (): Promise<T[]> => {
    const results = await logseq.DB.q(query);

    if (!results || !Array.isArray(results)) {
      return [];
    }

    const tasks: T[] = [];
    for (const block of results as BlockResult[]) {
      const { parentUuid, parentContent } = await fetchParentInfo(block.uuid);

      tasks.push({
        uuid: block.uuid,
        content: block.content || "",
        pageId: block.page?.id || 0,
        parentUuid,
        parentContent,
        ...mapper(block),
      } as T);
    }

    tasks.sort(comparator);
    return deduplicateHierarchy(tasks);
  }, [query, mapper, comparator]);

  const { data, loading, error, refetch } = usePolling({ fetcher });

  return { tasks: data ?? [], loading, error, refetch };
}
