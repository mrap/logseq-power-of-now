import { useState, useEffect, useCallback, useRef } from "react";
import { parseSnoozeInput } from "../utils/snooze";
import { formatAbsoluteDate } from "../utils/scheduling";

interface SnoozeModalProps {
  blockUuid: string;
  blockContent: string;
  onClose: () => void;
  onSnooze: (blockUuid: string, until: Date) => void;
}

/**
 * Modal for entering snooze duration with live parsing preview.
 */
export function SnoozeModal({
  blockUuid,
  blockContent,
  onClose,
  onSnooze,
}: SnoozeModalProps) {
  const [input, setInput] = useState("");
  const [parsedDate, setParsedDate] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse input as user types
  useEffect(() => {
    if (!input.trim()) {
      setParsedDate(null);
      return;
    }
    const date = parseSnoozeInput(input);
    setParsedDate(date);
  }, [input]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && parsedDate) {
        onSnooze(blockUuid, parsedDate);
        onClose();
      }
    },
    [parsedDate, blockUuid, onSnooze, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Get preview text for display
  const getDisplayContent = (content: string): string => {
    return content
      .replace(/^(NOW|TODO|LATER|WAITING)\s*/i, "")
      .replace(/\[#[ABC]\]\s*/gi, "")
      .replace(/:LOGBOOK:[\s\S]*?:END:/g, "")
      .replace(/SCHEDULED:\s*<[^>]+>/g, "")
      .substring(0, 50)
      .trim();
  };

  const displayContent = getDisplayContent(blockContent);
  const hasError = input.trim().length > 0 && !parsedDate;

  return (
    <div className="snooze-modal-overlay" onClick={handleBackdropClick}>
      <div className="snooze-modal">
        <div className="snooze-modal-header">
          Snooze: {displayContent || "Untitled"}
          {displayContent.length >= 50 && "..."}
        </div>
        <input
          ref={inputRef}
          type="text"
          className={`snooze-modal-input ${hasError ? "error" : ""}`}
          placeholder="e.g., 2h, tomorrow, next Monday"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="snooze-modal-preview">
          {parsedDate && (
            <span className="snooze-modal-preview-text">
              Will resurface: {formatAbsoluteDate(parsedDate)}
            </span>
          )}
          {hasError && (
            <span className="snooze-modal-error">
              Could not parse date
            </span>
          )}
          {!input.trim() && (
            <span className="snooze-modal-hint">
              Enter a time like "2h", "tomorrow", or "next Monday"
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
