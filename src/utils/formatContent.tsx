import React from "react";

/**
 * Combined regex to match tags and page references.
 * Captures: #tag or [[page reference]]
 */
const HIGHLIGHT_REGEX = /(#[a-zA-Z0-9_-]+|\[\[[^\]]+\]\])/g;

/**
 * Format content text with highlighted tags and page references.
 * Returns React nodes with styled spans for tags (#tag) and page refs ([[page]]).
 */
export function formatContentWithHighlights(text: string): React.ReactNode {
  const parts = text.split(HIGHLIGHT_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    // Check if this part is a tag
    if (part.startsWith("#") && part.length > 1) {
      return (
        <span key={index} className="task-tag">
          {part}
        </span>
      );
    }

    // Check if this part is a page reference
    if (part.startsWith("[[") && part.endsWith("]]")) {
      // Extract the page name without brackets
      const pageName = part.slice(2, -2);
      return (
        <span key={index} className="task-page-ref">
          {pageName}
        </span>
      );
    }

    // Plain text
    return part;
  });
}
