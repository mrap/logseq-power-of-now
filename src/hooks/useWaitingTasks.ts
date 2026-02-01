import { useBlockContext } from "../contexts/BlockContext";

export type { WaitingTask } from "../contexts/BlockContext";

/**
 * Hook that queries and polls for WAITING tasks from Logseq.
 * Returns tasks sorted by scheduled date (soonest first), with unscheduled at bottom.
 * Now a thin wrapper around BlockContext.
 */
export function useWaitingTasks() {
  const { waitingTasks, loading, refetch } = useBlockContext();

  return {
    tasks: waitingTasks,
    loading: loading.waiting,
    error: null,
    refetch,
  };
}
