import { useState, useEffect, useCallback } from "react";
import { TodayTask } from "../hooks/useTodayTasks";
import { getDisplayText } from "../utils/taskUtils";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { formatElapsedTime } from "../utils/formatElapsedTime";
import { parseScheduledDate, formatRelativeDate, formatAbsoluteDate } from "../utils/scheduling";

interface TodayTaskItemProps {
  task: TodayTask;
}

export function TodayTaskItem({ task }: TodayTaskItemProps) {
  const [completing, setCompleting] = useState(false);

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

  const handleClick = useCallback(async () => {
    try {
      const page = await logseq.Editor.getPage(task.pageId);
      if (page) {
        await logseq.Editor.scrollToBlockInPage(page.name, task.uuid);
      }
    } catch (err) {
      console.error("Failed to navigate to block:", err);
    }
  }, [task.pageId, task.uuid]);

  const handleComplete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (completing) return;

      setCompleting(true);
      try {
        // Replace task status with DONE
        const newContent = task.content.replace(
          /^(NOW|TODO|LATER|WAITING)\s*/i,
          "DONE "
        );
        await logseq.Editor.updateBlock(task.uuid, newContent);
      } catch (err) {
        console.error("Failed to complete task:", err);
        setCompleting(false);
      }
    },
    [task.uuid, task.content, completing]
  );

  const displayText = getDisplayText(task.content);

  // Get status-specific indicator content
  const getIndicator = () => {
    switch (task.status) {
      case "NOW":
        return (
          <span className="today-task-indicator today-task-indicator-now">
            {elapsedTime}
          </span>
        );
      case "TODO":
        return (
          <span className="today-task-indicator today-task-indicator-todo">
            TODO
          </span>
        );
      case "LATER":
        return (
          <span className="today-task-indicator today-task-indicator-later">
            LATER
          </span>
        );
      case "WAITING": {
        const scheduledDate = parseScheduledDate(task.content);
        const display = scheduledDate ? formatRelativeDate(scheduledDate) : "--";
        const tooltip = scheduledDate
          ? formatAbsoluteDate(scheduledDate)
          : "No scheduled date";
        return (
          <span
            className="today-task-indicator today-task-indicator-waiting"
            title={tooltip}
          >
            {display}
          </span>
        );
      }
      default:
        return null;
    }
  };

  // Show checkbox for tasks that can be completed (NOW, TODO, LATER)
  const showCheckbox = task.status === "NOW" || task.status === "TODO" || task.status === "LATER";

  return (
    <div
      className={`today-task-item ${task.isReferenced ? "is-referenced" : ""}`}
      data-status={task.status}
      onClick={handleClick}
    >
      {showCheckbox && (
        <button
          className={`today-task-checkbox ${completing ? "completing" : ""}`}
          onClick={handleComplete}
          disabled={completing}
          title="Mark as done"
        />
      )}
      {getIndicator()}
      <span className="today-task-text">{displayText || "Untitled task"}</span>
    </div>
  );
}
