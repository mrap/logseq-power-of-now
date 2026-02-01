import { useBlockContext } from "../contexts/BlockContext";

export type { NowTask } from "../contexts/BlockContext";

/**
 * Hook that queries and polls for NOW tasks from Logseq.
 * Now a thin wrapper around BlockContext.
 */
export function useNowTasks() {
  const { nowTasks, loading, refetch } = useBlockContext();

  return {
    tasks: nowTasks,
    loading: loading.now,
    error: null,
    refetch,
  };
}
