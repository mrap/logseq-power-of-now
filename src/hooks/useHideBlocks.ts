import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSnoozedTasks } from "./useSnoozedTasks";
import { useVisibleBlocks } from "./useVisibleBlocks";

interface DoneTask {
  uuid: string;
  parentUuid?: string;
}

interface ParentSummary {
  parentUuid: string;
  doneCount: number;
  snoozedCount: number;
}

/**
 * Hook that injects CSS to hide done and snoozed (not resurfaced) blocks in Logseq's main UI,
 * and injects summary badges into parent blocks showing hidden children counts.
 * Clicking a badge toggles visibility of that parent's hidden children.
 */
export function useHideBlocks(enabled: boolean) {
  const { pendingTasks } = useSnoozedTasks();
  const { visibleUuids } = useVisibleBlocks();
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>([]);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const previousBadgeKeysRef = useRef<Set<string>>(new Set());

  // Listen for toggle messages from badges in Logseq's main window
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "power-of-now:toggle-parent" && event.data.parentUuid) {
        setExpandedParents((prev) => {
          const next = new Set(prev);
          if (next.has(event.data.parentUuid)) {
            next.delete(event.data.parentUuid);
          } else {
            next.add(event.data.parentUuid);
          }
          return next;
        });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Query DONE tasks with parent info
  const fetchDoneTasks = useCallback(async () => {
    if (typeof logseq === "undefined") return;

    try {
      const results = await logseq.DB.q("(task DONE)");
      if (!results || !Array.isArray(results)) {
        setDoneTasks([]);
        return;
      }

      const tasks: DoneTask[] = [];
      for (const block of results as { uuid: string; parent?: { id: number } }[]) {
        let parentUuid: string | undefined;

        if (block.parent?.id) {
          try {
            const parentBlock = await logseq.Editor.getBlock(block.parent.id);
            if (parentBlock) {
              parentUuid = parentBlock.uuid;
            }
          } catch {
            // Parent might be a page
          }
        }

        tasks.push({ uuid: block.uuid, parentUuid });
      }

      setDoneTasks(tasks);
    } catch (err) {
      console.error("[useHideBlocks] Failed to fetch DONE tasks:", err);
    }
  }, []);

  // Fetch DONE tasks on mount and periodically
  useEffect(() => {
    fetchDoneTasks();
    const intervalId = setInterval(fetchDoneTasks, 5000);
    return () => clearInterval(intervalId);
  }, [fetchDoneTasks]);

  // Compute parent summaries
  const parentSummaries = useMemo((): ParentSummary[] => {
    if (!enabled) return [];

    const summaryMap = new Map<string, ParentSummary>();

    for (const task of pendingTasks) {
      if (task.parentUuid) {
        const existing = summaryMap.get(task.parentUuid) || {
          parentUuid: task.parentUuid,
          doneCount: 0,
          snoozedCount: 0,
        };
        existing.snoozedCount++;
        summaryMap.set(task.parentUuid, existing);
      }
    }

    for (const task of doneTasks) {
      if (task.parentUuid) {
        const existing = summaryMap.get(task.parentUuid) || {
          parentUuid: task.parentUuid,
          doneCount: 0,
          snoozedCount: 0,
        };
        existing.doneCount++;
        summaryMap.set(task.parentUuid, existing);
      }
    }

    return Array.from(summaryMap.values());
  }, [enabled, pendingTasks, doneTasks]);

  // Get child UUIDs for expanded parents (to exclude from hiding)
  const expandedChildUuids = useMemo(() => {
    const uuids = new Set<string>();

    for (const parentUuid of expandedParents) {
      // Find snoozed children of this parent
      for (const task of pendingTasks) {
        if (task.parentUuid === parentUuid) {
          uuids.add(task.uuid);
        }
      }
      // Find done children of this parent
      for (const task of doneTasks) {
        if (task.parentUuid === parentUuid) {
          uuids.add(task.uuid);
        }
      }
    }

    return uuids;
  }, [expandedParents, pendingTasks, doneTasks]);

  // Generate hiding CSS
  const css = useMemo(() => {
    if (!enabled) {
      return "/* hiding disabled */";
    }

    const rules: string[] = [];

    // Get list of done task UUIDs that should remain hidden (not in expanded parents)
    const hiddenDoneUuids = doneTasks
      .filter((t) => !expandedChildUuids.has(t.uuid))
      .map((t) => t.uuid);

    // Hide DONE blocks - but exclude those in expanded parents
    if (hiddenDoneUuids.length > 0) {
      // Use specific UUIDs for done blocks too (for proper exclusion)
      const doneSelectors = hiddenDoneUuids
        .map((uuid) => `.ls-block[blockid="${uuid}"]`)
        .join(",\n");
      rules.push(`${doneSelectors} { display: none !important; }`);
    } else {
      // Fallback: hide all done if no expanded parents
      const hasExpandedParentsWithDone = doneTasks.some((t) =>
        t.parentUuid && expandedParents.has(t.parentUuid)
      );
      if (!hasExpandedParentsWithDone) {
        rules.push(`.ls-block[data-refs-self*='"done"'] { display: none !important; }`);
      }
    }

    // Hide snoozed blocks - exclude those in expanded parents
    const hiddenSnoozedUuids = pendingTasks
      .filter((t) => !expandedChildUuids.has(t.uuid))
      .map((t) => t.uuid);

    if (hiddenSnoozedUuids.length > 0) {
      const selectors = hiddenSnoozedUuids
        .map((uuid) => `.ls-block[blockid="${uuid}"]`)
        .join(",\n");
      rules.push(`${selectors} { display: none !important; }`);
    }

    // Style for parent badges
    rules.push(`
      .power-of-now-hidden-badge {
        font-size: 10px;
        color: #888;
        background: rgba(100, 100, 100, 0.2);
        padding: 1px 6px;
        border-radius: 8px;
        margin-left: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      .power-of-now-hidden-badge:hover {
        background: rgba(100, 100, 100, 0.4);
      }
      .power-of-now-hidden-badge.expanded {
        background: rgba(59, 130, 246, 0.2);
        color: #3b82f6;
      }
    `);

    return rules.join("\n");
  }, [enabled, pendingTasks, doneTasks, expandedChildUuids, expandedParents]);

  // Inject hiding CSS
  useEffect(() => {
    if (typeof logseq !== "undefined" && logseq.provideStyle) {
      logseq.provideStyle({ key: "hide-blocks", style: css });
    }
  }, [css]);

  // Inject parent summary badges via provideUI
  // Only inject for blocks that are currently visible to avoid console warnings
  useEffect(() => {
    if (typeof logseq === "undefined" || !logseq.provideUI) return;

    const currentBadgeKeys = new Set<string>();

    if (enabled) {
      for (const summary of parentSummaries) {
        // Skip if parent block is not currently visible
        if (!visibleUuids.has(summary.parentUuid)) continue;

        const parts: string[] = [];
        if (summary.doneCount > 0) parts.push(`${summary.doneCount} done`);
        if (summary.snoozedCount > 0) parts.push(`${summary.snoozedCount} snoozed`);

        if (parts.length > 0) {
          const key = `hidden-badge-${summary.parentUuid}`;
          currentBadgeKeys.add(key);

          const isExpanded = expandedParents.has(summary.parentUuid);
          const expandedClass = isExpanded ? " expanded" : "";
          const label = isExpanded ? `▼ ${parts.join(", ")}` : `▶ ${parts.join(", ")}`;

          try {
            logseq.provideUI({
              key,
              path: `.ls-block[blockid="${summary.parentUuid}"] .block-content-inner`,
              template: `<span class="power-of-now-hidden-badge${expandedClass}" onclick="event.stopPropagation();event.preventDefault();Array.from(document.querySelectorAll('iframe')).forEach(function(f){try{f.contentWindow.postMessage({type:'power-of-now:toggle-parent',parentUuid:'${summary.parentUuid}'},'*')}catch(e){}})">${label}</span>`,
            });
          } catch {
            // Silently ignore - selector may not exist on current page
          }
        }
      }
    }

    // Remove badges that are no longer needed
    for (const oldKey of previousBadgeKeysRef.current) {
      if (!currentBadgeKeys.has(oldKey)) {
        logseq.provideUI({
          key: oldKey,
          path: "body",
          template: null,
        });
      }
    }

    previousBadgeKeysRef.current = currentBadgeKeys;
  }, [enabled, parentSummaries, expandedParents, visibleUuids]);
}
