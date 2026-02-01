import { useBlockContext } from "../contexts/BlockContext";

export type { TodayTask } from "../contexts/BlockContext";

/**
 * Hook that queries today's journal page and returns tasks grouped by status.
 * Now a thin wrapper around BlockContext.
 */
export function useTodayTasks() {
  const { todayData, loading, refetch } = useBlockContext();

  return {
    nowTasks: todayData.nowTasks,
    todoLaterTasks: todayData.todoLaterTasks,
    waitingTasks: todayData.waitingTasks,
    loading: loading.today,
    error: null,
    refetch,
  };
}
