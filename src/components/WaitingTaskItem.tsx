import { useCallback } from "react";
import { WaitingTask } from "../hooks/useWaitingTasks";
import { formatRelativeDate, formatAbsoluteDate } from "../utils/scheduling";

interface WaitingTaskItemProps {
  task: WaitingTask;
}

/**
 * Extracts a clean display text from block content.
 * Removes the WAITING marker, priority, timestamps, SCHEDULED, and LOGBOOK section.
 */
function getDisplayText(content: string): string {
  return content
    .replace(/^WAITING\s*/i, "") // Remove WAITING marker
    .replace(/\[#[ABC]\]\s*/gi, "") // Remove priority marker [#A], [#B], [#C]
    .replace(/:LOGBOOK:[\s\S]*?:END:/g, "") // Remove LOGBOOK section
    .replace(/\[[\d-]+\s+\w+\s+[\d:]+\]/g, "") // Remove timestamps like [2024-01-19 Fri 10:30]
    .replace(/SCHEDULED:\s*<[^>]+>/g, "") // Remove SCHEDULED
    .replace(/DEADLINE:\s*<[^>]+>/g, "") // Remove DEADLINE
    .trim();
}

export function WaitingTaskItem({ task }: WaitingTaskItemProps) {
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

  const displayText = getDisplayText(task.content);

  // Format the scheduled date for display
  const scheduleDisplay = task.scheduledDate
    ? formatRelativeDate(task.scheduledDate)
    : "--";

  const scheduleTooltip = task.scheduledDate
    ? formatAbsoluteDate(task.scheduledDate)
    : "No scheduled date";

  return (
    <div className="waiting-task-item" onClick={handleClick}>
      <span className="waiting-task-time" title={scheduleTooltip}>
        {scheduleDisplay}
      </span>
      <span className="waiting-task-text">{displayText || "Untitled task"}</span>
    </div>
  );
}
