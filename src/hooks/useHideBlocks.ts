import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSnoozedTasks } from "./useSnoozedTasks";
import { useVisibleBlocks } from "./useVisibleBlocks";
import { extractBlockReferences } from "../utils/hierarchyUtils";
import { fetchBlockContents } from "../utils/blockUtils";

interface DoneTask {
  uuid: string;
  parentUuid?: string;
}

interface HiddenBlock {
  uuid: string;
  parentUuid?: string;
  type: "done" | "snoozed" | "done-ref" | "snoozed-ref";
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
  const [referenceBlocks, setReferenceBlocks] = useState<HiddenBlock[]>([]);
  const [parentsWithActiveChildren, setParentsWithActiveChildren] = useState<Set<string>>(new Set());
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

  // Find blocks that reference done/snoozed tasks, and track parents with active children
  useEffect(() => {
    async function findReferenceBlocks() {
      if (typeof logseq === "undefined" || !enabled) {
        setReferenceBlocks((prev) => (prev.length === 0 ? prev : []));
        setParentsWithActiveChildren((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }

      // Build set of done/snoozed UUIDs
      const hiddenUuids = new Set<string>([
        ...doneTasks.map((t) => t.uuid),
        ...pendingTasks.map((t) => t.uuid),
      ]);

      if (hiddenUuids.size === 0) {
        setReferenceBlocks((prev) => (prev.length === 0 ? prev : []));
        setParentsWithActiveChildren((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }

      // Fetch content for all visible blocks
      const blockContents = await fetchBlockContents(visibleUuids);

      // Find blocks that reference done/snoozed tasks
      // Also track which done/snoozed parents have active (non-hidden) children
      const refs: HiddenBlock[] = [];
      const activeChildParents = new Set<string>();

      for (const [uuid, blockInfo] of blockContents) {
        const isHidden = hiddenUuids.has(uuid);

        // If this block is NOT hidden and its parent IS hidden,
        // mark that parent as having active children (shouldn't be hidden)
        if (!isHidden && blockInfo.parentUuid && hiddenUuids.has(blockInfo.parentUuid)) {
          activeChildParents.add(blockInfo.parentUuid);
        }

        // Skip hidden blocks for reference detection
        if (isHidden) continue;

        // Skip if parent is not in visible blocks (would cause selector error)
        if (blockInfo.parentUuid && !visibleUuids.has(blockInfo.parentUuid)) continue;

        const referencedUuids = extractBlockReferences(blockInfo.content);
        for (const refUuid of referencedUuids) {
          if (hiddenUuids.has(refUuid)) {
            // This block references a done/snoozed task
            const isDoneRef = doneTasks.some((t) => t.uuid === refUuid);
            refs.push({
              uuid,
              parentUuid: blockInfo.parentUuid,
              type: isDoneRef ? "done-ref" : "snoozed-ref",
            });
            break; // Only count each block once
          }
        }
      }

      // Only update state if refs actually changed (avoid unnecessary re-renders)
      setReferenceBlocks((prev) => {
        if (
          prev.length === refs.length &&
          prev.every((p, i) => p.uuid === refs[i]?.uuid && p.type === refs[i]?.type)
        ) {
          return prev;
        }
        return refs;
      });

      // Update parents with active children
      setParentsWithActiveChildren((prev) => {
        const prevArray = Array.from(prev).sort();
        const newArray = Array.from(activeChildParents).sort();
        if (
          prevArray.length === newArray.length &&
          prevArray.every((v, i) => v === newArray[i])
        ) {
          return prev;
        }
        return activeChildParents;
      });
    }

    findReferenceBlocks();
  }, [enabled, doneTasks, pendingTasks, visibleUuids]);

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

    // Count reference blocks (treat done-refs as done, snoozed-refs as snoozed)
    for (const ref of referenceBlocks) {
      if (ref.parentUuid) {
        const existing = summaryMap.get(ref.parentUuid) || {
          parentUuid: ref.parentUuid,
          doneCount: 0,
          snoozedCount: 0,
        };
        if (ref.type === "done-ref") {
          existing.doneCount++;
        } else {
          existing.snoozedCount++;
        }
        summaryMap.set(ref.parentUuid, existing);
      }
    }

    return Array.from(summaryMap.values());
  }, [enabled, pendingTasks, doneTasks, referenceBlocks]);

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
      // Find reference block children of this parent
      for (const ref of referenceBlocks) {
        if (ref.parentUuid === parentUuid) {
          uuids.add(ref.uuid);
        }
      }
    }

    return uuids;
  }, [expandedParents, pendingTasks, doneTasks, referenceBlocks]);

  // Generate hiding CSS
  const css = useMemo(() => {
    if (!enabled) {
      return "/* hiding disabled */";
    }

    const rules: string[] = [];

    // Get list of done task UUIDs that should remain hidden
    // Exclude: expanded children, and parents with active (non-hidden) children
    const hiddenDoneUuids = [
      ...doneTasks
        .filter((t) => !expandedChildUuids.has(t.uuid) && !parentsWithActiveChildren.has(t.uuid))
        .map((t) => t.uuid),
      ...referenceBlocks
        .filter((r) => r.type === "done-ref" && !expandedChildUuids.has(r.uuid))
        .map((r) => r.uuid),
    ];

    // Hide DONE blocks and done-reference blocks
    if (hiddenDoneUuids.length > 0) {
      const doneSelectors = hiddenDoneUuids
        .map((uuid) => `.ls-block[blockid="${uuid}"]`)
        .join(",\n");
      rules.push(`${doneSelectors} { display: none !important; }`);
    } else {
      // Fallback: hide all done if no expanded parents and no active children
      const hasExpandedParentsWithDone = doneTasks.some((t) =>
        t.parentUuid && expandedParents.has(t.parentUuid)
      );
      if (!hasExpandedParentsWithDone && parentsWithActiveChildren.size === 0) {
        rules.push(`.ls-block[data-refs-self*='"done"'] { display: none !important; }`);
      }
    }

    // Get list of snoozed UUIDs that should remain hidden
    // Exclude: expanded children, and parents with active (non-hidden) children
    const hiddenSnoozedUuids = [
      ...pendingTasks
        .filter((t) => !expandedChildUuids.has(t.uuid) && !parentsWithActiveChildren.has(t.uuid))
        .map((t) => t.uuid),
      ...referenceBlocks
        .filter((r) => r.type === "snoozed-ref" && !expandedChildUuids.has(r.uuid))
        .map((r) => r.uuid),
    ];

    // Hide snoozed blocks and snoozed-reference blocks
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
  }, [enabled, pendingTasks, doneTasks, referenceBlocks, expandedChildUuids, expandedParents, parentsWithActiveChildren]);

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
