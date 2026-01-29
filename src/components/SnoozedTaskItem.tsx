import { useCallback, useState } from "react";
import { SnoozedTask } from "../hooks/useSnoozedTasks";
import { TaskItem } from "./TaskItem";

interface SnoozedTaskItemProps {
  task: SnoozedTask;
  onRefetch?: () => void;
  onResnooze?: (uuid: string, until: Date) => void;
}

/**
 * Format milliseconds as a human-readable duration string
 */
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/**
 * Display component for a snoozed task.
 * Shows snooze status, timing info, and allows unsnoozing or re-snoozing.
 */
export function SnoozedTaskItem({
  task,
  onRefetch,
  onResnooze,
}: SnoozedTaskItemProps) {
  const [unsnoozing, setUnsnoozing] = useState(false);
  const [resnoozing, setResnoozing] = useState(false);

  const handleUnsnooze = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
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

  const handleResnooze = useCallback(
    (e: React.MouseEvent, minutes: number) => {
      e.stopPropagation();
      if (resnoozing || !onResnooze) return;

      setResnoozing(true);
      const until = new Date(Date.now() + minutes * 60 * 1000);
      onResnooze(task.uuid, until);
    },
    [task.uuid, resnoozing, onResnooze]
  );

  const handleRepeatSnooze = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (resnoozing || !onResnooze) return;

      setResnoozing(true);
      const originalDuration =
        task.snoozeUntil.getTime() - task.snoozedAt.getTime();
      const until = new Date(Date.now() + originalDuration);
      onResnooze(task.uuid, until);
    },
    [task.uuid, task.snoozeUntil, task.snoozedAt, resnoozing, onResnooze]
  );

  const originalDurationMs =
    task.snoozeUntil.getTime() - task.snoozedAt.getTime();
  const repeatLabel = `↻${formatDuration(originalDurationMs)}`;

  const actionButtons = (
    <div className="snoozed-task-actions">
      <button
        className={`snooze-action-btn ${resnoozing ? "resnoozing" : ""}`}
        onClick={(e) => handleResnooze(e, 5)}
        disabled={resnoozing}
        title="Snooze for 5 minutes"
      >
        5m
      </button>
      <button
        className={`snooze-action-btn ${resnoozing ? "resnoozing" : ""}`}
        onClick={(e) => handleResnooze(e, 30)}
        disabled={resnoozing}
        title="Snooze for 30 minutes"
      >
        30m
      </button>
      <button
        className={`snooze-action-btn ${resnoozing ? "resnoozing" : ""}`}
        onClick={(e) => handleResnooze(e, 60)}
        disabled={resnoozing}
        title="Snooze for 1 hour"
      >
        1h
      </button>
      <button
        className={`snooze-action-btn repeat ${resnoozing ? "resnoozing" : ""}`}
        onClick={handleRepeatSnooze}
        disabled={resnoozing}
        title={`Repeat original snooze duration (${formatDuration(originalDurationMs)})`}
      >
        {repeatLabel}
      </button>
      <button
        className={`snooze-action-btn unsnooze ${unsnoozing ? "unsnoozing" : ""}`}
        onClick={handleUnsnooze}
        disabled={unsnoozing}
        title="Remove snooze"
      >
        ✕
      </button>
    </div>
  );

  return (
    <TaskItem
      uuid={task.uuid}
      content={task.content}
      pageId={task.pageId}
      canComplete={true}
      secondaryText={`${task.snoozeDisplayText} • ${task.snoozedAtDisplayText}`}
      rightSlot={actionButtons}
      variant={task.isResurfaced ? "resurfaced" : "pending"}
      className="snoozed-task"
    />
  );
}
