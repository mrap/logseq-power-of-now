import { useBlockContext } from "../contexts/BlockContext";

export type { SnoozedTask } from "../contexts/BlockContext";

/**
 * Hook that queries and polls for snoozed tasks from Logseq.
 * Separates tasks into resurfaced (snooze expired) and pending (still snoozed).
 * Now a thin wrapper around BlockContext.
 */
export function useSnoozedTasks() {
  const {
    snoozedTasks,
    resurfacedTasks,
    pendingTasks,
    loading,
    refetch,
    unreadCount,
    markAllSeen,
  } = useBlockContext();

  return {
    tasks: snoozedTasks,
    resurfacedTasks,
    pendingTasks,
    loading: loading.snoozed,
    error: null,
    refetch, // Same as refetchSnoozed now
    unreadCount,
    markAllSeen,
  };
}
