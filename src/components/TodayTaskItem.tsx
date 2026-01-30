import { useState, useEffect } from "react";
import { TodayTask } from "../hooks/useTodayTasks";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { formatElapsedTime } from "../utils/formatElapsedTime";
import {
  parseScheduledDate,
  formatRelativeDate,
  formatAbsoluteDate,
} from "../utils/scheduling";
import { TaskItem } from "./TaskItem";

interface TodayTaskItemProps {
  task: TodayTask;
}

export function TodayTaskItem({ task }: TodayTaskItemProps) {
  // For NOW tasks, track elapsed time
  const [elapsedTime, setElapsedTime] = useState(() => {
    if (task.status === "NOW") {
      const elapsed = getElapsedTimeFromContent(task.content);
      return elapsed > 0 ? formatElapsedTime(elapsed) : "--";
    }
    return null;
  });

  // Update elapsed time every minute for NOW tasks
  useEffect(() => {
    if (task.status !== "NOW") return;

    const updateTime = () => {
      const elapsed = getElapsedTimeFromContent(task.content);
      setElapsedTime(elapsed > 0 ? formatElapsedTime(elapsed) : "--");
    };

    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, [task.content, task.status]);

  // Get status-specific indicator content
  const getIndicator = () => {
    switch (task.status) {
      case "NOW":
        return <span className="task-time now">{elapsedTime}</span>;
      case "TODO":
        return <span className="task-status-badge todo">TODO</span>;
      case "LATER":
        return <span className="task-status-badge later">LATER</span>;
      case "WAITING": {
        const scheduledDate = parseScheduledDate(task.content);
        const display = scheduledDate
          ? formatRelativeDate(scheduledDate)
          : "--";
        const tooltip = scheduledDate
          ? formatAbsoluteDate(scheduledDate)
          : "No scheduled date";
        return (
          <span className="task-time waiting" title={tooltip}>
            {display}
          </span>
        );
      }
      default:
        return null;
    }
  };

  return (
    <TaskItem
      uuid={task.uuid}
      content={task.content}
      pageId={task.pageId}
      canComplete={true}
      leftSlot={getIndicator()}
      secondaryText={task.parentContext}
      variant={task.isReferenced ? "referenced" : "default"}
      className="today-task"
    />
  );
}
