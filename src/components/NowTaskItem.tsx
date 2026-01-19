import { useState, useEffect, useCallback } from "react";
import { NowTask } from "../hooks/useNowTasks";
import { getElapsedTimeFromContent } from "../utils/timeTracking";
import { formatElapsedTime } from "../utils/formatElapsedTime";

interface NowTaskItemProps {
  task: NowTask;
}

/**
 * Extracts a clean display text from block content.
 * Removes the NOW marker, priority, timestamps, and LOGBOOK section.
 */
function getDisplayText(content: string): string {
  return content
    .replace(/^NOW\s*/i, "") // Remove NOW marker
    .replace(/\[#[ABC]\]\s*/gi, "") // Remove priority marker [#A], [#B], [#C]
    .replace(/:LOGBOOK:[\s\S]*?:END:/g, "") // Remove LOGBOOK section
    .replace(/\[[\d-]+\s+\w+\s+[\d:]+\]/g, "") // Remove timestamps like [2024-01-19 Fri 10:30]
    .replace(/SCHEDULED:\s*<[^>]+>/g, "") // Remove SCHEDULED
    .replace(/DEADLINE:\s*<[^>]+>/g, "") // Remove DEADLINE
    .trim();
}

export function NowTaskItem({ task }: NowTaskItemProps) {
  const [elapsedTime, setElapsedTime] = useState(() => {
    const elapsed = getElapsedTimeFromContent(task.content);
    return elapsed > 0 ? formatElapsedTime(elapsed) : "--";
  });

  // Update elapsed time every minute
  useEffect(() => {
    const updateTime = () => {
      const elapsed = getElapsedTimeFromContent(task.content);
      setElapsedTime(elapsed > 0 ? formatElapsedTime(elapsed) : "--");
    };

    const intervalId = setInterval(updateTime, 60000);
    return () => clearInterval(intervalId);
  }, [task.content]);

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

  return (
    <div className="now-task-item" onClick={handleClick}>
      <span className="now-task-time">{elapsedTime}</span>
      <span className="now-task-text">{displayText || "Untitled task"}</span>
    </div>
  );
}
