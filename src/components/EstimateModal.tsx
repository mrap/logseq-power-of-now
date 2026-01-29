import { useState, useEffect, useCallback, useRef } from "react";
import {
  parseEstimateInput,
  formatEstimatePreview,
  formatEstimate,
} from "../utils/estimate";

interface EstimateModalProps {
  blockUuid: string;
  blockContent: string;
  currentEstimate: number | null;
  onClose: () => void;
  onEstimate: (blockUuid: string, minutes: number) => void;
  onRemove: (blockUuid: string) => void;
}

/**
 * Modal for entering time estimate with live parsing preview.
 */
export function EstimateModal({
  blockUuid,
  blockContent,
  currentEstimate,
  onClose,
  onEstimate,
  onRemove,
}: EstimateModalProps) {
  const [input, setInput] = useState(
    currentEstimate ? formatEstimate(currentEstimate) : ""
  );
  const [parsedMinutes, setParsedMinutes] = useState<number | null>(
    currentEstimate
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Parse input as user types
  useEffect(() => {
    if (!input.trim()) {
      setParsedMinutes(null);
      return;
    }
    const minutes = parseEstimateInput(input);
    setParsedMinutes(minutes);
  }, [input]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && parsedMinutes !== null) {
        onEstimate(blockUuid, parsedMinutes);
        onClose();
      }
    },
    [parsedMinutes, blockUuid, onEstimate, onClose]
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

  // Handle remove button
  const handleRemove = useCallback(() => {
    onRemove(blockUuid);
    onClose();
  }, [blockUuid, onRemove, onClose]);

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
  const hasError = input.trim().length > 0 && parsedMinutes === null;

  return (
    <div className="estimate-modal-overlay" onClick={handleBackdropClick}>
      <div className="estimate-modal">
        <div className="estimate-modal-header">
          Estimate: {displayContent || "Untitled"}
          {displayContent.length >= 50 && "..."}
        </div>
        <input
          ref={inputRef}
          type="text"
          className={`estimate-modal-input ${hasError ? "error" : ""}`}
          placeholder="e.g., 30m, 2h, 1h30m, 1d"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="estimate-modal-preview">
          {parsedMinutes !== null && (
            <span className="estimate-modal-preview-text">
              {formatEstimatePreview(parsedMinutes)}
            </span>
          )}
          {hasError && (
            <span className="estimate-modal-error">Could not parse estimate</span>
          )}
          {!input.trim() && (
            <span className="estimate-modal-hint">
              Enter a duration like "30m", "2h", or "1h30m"
            </span>
          )}
        </div>
        {currentEstimate !== null && (
          <button className="estimate-modal-remove" onClick={handleRemove}>
            Remove estimate
          </button>
        )}
      </div>
    </div>
  );
}
