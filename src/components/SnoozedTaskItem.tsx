import { useCallback, useState } from "react";
import { SnoozedTask } from "../hooks/useSnoozedTasks";
import { getDisplayText } from "../utils/taskUtils";

interface SnoozedTaskItemProps {
  task: SnoozedTask;
  onRefetch?: () => void;
}

/**
 * Display component for a snoozed task.
 * Shows snooze status, timing info, and allows unsnoozing.
 */
export function SnoozedTaskItem({ task, onRefetch }: SnoozedTaskItemProps) {
  const [unsnoozing, setUnsnoozing] = useState(false);

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

  const handleUnsnooze = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation(); // Don't trigger navigation
      if (unsnoozing) return;

      setUnsnoozing(true);
      try {
        await logseq.Editor.removeBlockProperty(task.uuid, "snoozed-until");
        await logseq.Editor.removeBlockProperty(task.uuid, "snoozed-at");
        onRefetch?.();
      } catch (err) {
        console.error("Failed to unsnooze task:", err);
        setUnsnoozing(false);
      }
    },
    [task.uuid, unsnoozing, onRefetch]
  );

  const displayText = getDisplayText(task.content);

  return (
    <div
      className={`snoozed-task-item ${task.isResurfaced ? "resurfaced" : "pending"}`}
      onClick={handleClick}
    >
      <div className="snoozed-task-content">
        <span className="snoozed-task-text">{displayText || "Untitled task"}</span>
        <span className="snoozed-task-timing">
          {task.snoozeDisplayText} • {task.snoozedAtDisplayText}
        </span>
      </div>
      <button
        className={`snoozed-task-unsnooze ${unsnoozing ? "unsnoozing" : ""}`}
        onClick={handleUnsnooze}
        disabled={unsnoozing}
        title="Remove snooze"
      >
        ✕
      </button>
    </div>
  );
}
