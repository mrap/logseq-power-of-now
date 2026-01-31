import { useTaskQuery } from "./useTaskQuery";
import { BaseTask } from "../utils/hierarchyUtils";
import { compareNowTasks } from "../utils/taskComparators";

export type NowTask = BaseTask;

/**
 * Hook that queries and polls for NOW tasks from Logseq
 */
export function useNowTasks() {
  return useTaskQuery<NowTask>({
    query: "(task NOW)",
    comparator: compareNowTasks,
  });
}
