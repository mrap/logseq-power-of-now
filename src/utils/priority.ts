/**
 * Extract priority from content. Returns 'A', 'B', 'C', or null (no priority).
 * Logseq priority format: [#A], [#B], [#C]
 */
export function getPriority(content: string): string | null {
  const match = content.match(/\[#([ABC])\]/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Returns a numeric order for priority comparison.
 * Lower number = higher priority: A=1, B=2, C=3, none=4
 */
export function priorityOrder(p: string | null): number {
  if (p === "A") return 1;
  if (p === "B") return 2;
  if (p === "C") return 3;
  return 4;
}
