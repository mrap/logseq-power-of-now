import { WaitingTask } from "../hooks/useWaitingTasks";
import { formatRelativeDate, formatAbsoluteDate } from "../utils/scheduling";
import { TaskItem } from "./TaskItem";

interface WaitingTaskItemProps {
  task: WaitingTask;
}

export function WaitingTaskItem({ task }: WaitingTaskItemProps) {
  // Format the scheduled date for display
  const scheduleDisplay = task.scheduledDate
    ? formatRelativeDate(task.scheduledDate)
    : "--";

  const scheduleTooltip = task.scheduledDate
    ? formatAbsoluteDate(task.scheduledDate)
    : "No scheduled date";

  return (
    <TaskItem
      uuid={task.uuid}
      content={task.content}
      pageId={task.pageId}
      canComplete={true}
      leftSlot={
        <span className="task-time waiting" title={scheduleTooltip}>
          {scheduleDisplay}
        </span>
      }
      className="waiting-task"
    />
  );
}
