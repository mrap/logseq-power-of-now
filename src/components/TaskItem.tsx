import { useState, useCallback } from "react";
import { getDisplayText } from "../utils/taskUtils";

interface TaskItemProps {
  uuid: string;
  content: string;
  pageId: number;

  // Optional completion
  canComplete?: boolean;
  onComplete?: () => void;

  // Optional left slot (elapsed time, status badge, etc.)
  leftSlot?: React.ReactNode;

  // Optional right slot (action buttons for snoozed items)
  rightSlot?: React.ReactNode;

  // Optional secondary text (timing info, etc.)
  secondaryText?: string;

  // Styling variants
  variant?: "default" | "resurfaced" | "pending" | "referenced";

  className?: string;
}

/**
 * Unified task item component with:
 * - Click to navigate to block
 * - Shift-click to open in right sidebar
 * - Optional checkbox for marking as done
 * - Slots for custom content (left, right, secondary)
 */
export function TaskItem({
  uuid,
  content,
  pageId,
  canComplete = false,
  onComplete,
  leftSlot,
  rightSlot,
  secondaryText,
  variant = "default",
  className,
}: TaskItemProps) {
  const [completing, setCompleting] = useState(false);

  // Click to navigate, shift-click to open in sidebar
  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      try {
        const page = await logseq.Editor.getPage(pageId);
        if (page) {
          if (e.shiftKey) {
            // Open in sidebar
            await logseq.Editor.openInRightSidebar(uuid);
          } else {
            // Navigate to block
            await logseq.Editor.scrollToBlockInPage(page.name, uuid);
          }
        }
      } catch (err) {
        console.error("Failed to navigate to block:", err);
      }
    },
    [pageId, uuid]
  );

  // Default completion: replace task marker with DONE
  const handleComplete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (completing) return;

      setCompleting(true);
      try {
        if (onComplete) {
          onComplete();
        } else {
          const newContent = content.replace(
            /^(NOW|TODO|LATER|WAITING)\s*/i,
            "DONE "
          );
          await logseq.Editor.updateBlock(uuid, newContent);
        }
      } catch (err) {
        console.error("Failed to complete task:", err);
        setCompleting(false);
      }
    },
    [uuid, content, completing, onComplete]
  );

  const displayText = getDisplayText(content);

  const variantClass = variant !== "default" ? variant : "";

  return (
    <div
      className={`task-item ${variantClass} ${className || ""}`.trim()}
      onClick={handleClick}
    >
      {canComplete && (
        <button
          className={`task-checkbox ${completing ? "completing" : ""}`}
          onClick={handleComplete}
          disabled={completing}
        />
      )}
      {leftSlot}
      <div className="task-content">
        <span className="task-text">{displayText || "Untitled task"}</span>
        {secondaryText && (
          <span className="task-secondary">{secondaryText}</span>
        )}
      </div>
      {rightSlot}
    </div>
  );
}
