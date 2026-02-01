import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getAllAncestorUuids, fetchParentInfo } from "../utils/blockUtils";
import { getSnoozeInfo, isResurfaced, getSnoozeDisplayText, getSnoozedAtDisplayText } from "../utils/snooze";
import { getTaskStatus, getDisplayText, TaskStatus } from "../utils/taskUtils";
import { deduplicateHierarchy, extractBlockReferences, BaseTask } from "../utils/hierarchyUtils";
import { compareNowTasks } from "../utils/taskComparators";
import { formatLogseqDate } from "../utils/dateFormat";
import { parseScheduledDate } from "../utils/scheduling";

// Task type definitions
export type NowTask = BaseTask;

export interface WaitingTask extends BaseTask {
  scheduledDate: Date | null;
}

export interface SnoozedTask extends BaseTask {
  snoozeUntil: Date;
  snoozedAt: Date;
  isResurfaced: boolean;
  snoozeDisplayText: string;
  snoozedAtDisplayText: string;
}

export interface TodayTask extends BaseTask {
  status: TaskStatus;
  isReferenced: boolean;
  createdAt?: number;
}

interface DoneTask {
  uuid: string;
  parentUuid?: string;
}

interface BlockEntity {
  uuid: string;
  content: string;
  page?: { id: number };
  parent?: { id: number };
  children?: BlockEntity[];
  id?: number;
}

interface SidebarItem {
  type: "page" | "block";
  uuid: string;
}

interface PageEntity {
  name?: string;
  uuid?: string;
  originalName?: string;
}

interface TodayTasksData {
  nowTasks: TodayTask[];
  todoLaterTasks: TodayTask[];
  waitingTasks: TodayTask[];
}

interface BlockContextValue {
  // Raw task arrays
  nowTasks: NowTask[];
  waitingTasks: WaitingTask[];
  snoozedTasks: SnoozedTask[];
  doneTasks: DoneTask[];
  todayData: TodayTasksData;

  // Derived data (computed once in context)
  resurfacedTasks: SnoozedTask[];
  pendingTasks: SnoozedTask[];
  ancestorsOfActive: Set<string>;
  activeTaskUuids: Set<string>;

  // Context state
  visibleUuids: Set<string>;
  activeBlockUuid: string | null;

  // Loading states per query
  loading: {
    now: boolean;
    waiting: boolean;
    snoozed: boolean;
    today: boolean;
    done: boolean;
    visible: boolean;
  };

  // Actions
  refetch: () => Promise<void>;
  refetchSnoozed: () => Promise<void>;

  // Snoozed notification state
  unreadCount: number;
  markAllSeen: () => void;
}

const BlockContext = createContext<BlockContextValue | null>(null);

export function BlockContextProvider({ children }: { children: React.ReactNode }) {
  // State for all task data
  const [nowTasks, setNowTasks] = useState<NowTask[]>([]);
  const [waitingTasks, setWaitingTasks] = useState<WaitingTask[]>([]);
  const [snoozedTasks, setSnoozedTasks] = useState<SnoozedTask[]>([]);
  const [doneTasks, setDoneTasks] = useState<DoneTask[]>([]);
  const [todayData, setTodayData] = useState<TodayTasksData>({
    nowTasks: [],
    todoLaterTasks: [],
    waitingTasks: [],
  });

  // State for derived data
  const [activeTaskUuids, setActiveTaskUuids] = useState<Set<string>>(new Set());
  const [ancestorsOfActive, setAncestorsOfActive] = useState<Set<string>>(new Set());

  // State for visible blocks and active block
  const [visibleUuids, setVisibleUuids] = useState<Set<string>>(new Set());
  const [activeBlockUuid, setActiveBlockUuid] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading] = useState({
    now: true,
    waiting: true,
    snoozed: true,
    today: true,
    done: true,
    visible: true,
  });

  // Refs for snoozed task notifications (from useSnoozedTasks)
  const notifiedUuidsRef = useRef<Set<string>>(new Set());
  const doneTasksRef = useRef<Map<string, { content: string; doneAt: number }>>(new Map());
  const [seenUuids, setSeenUuids] = useState<Set<string>>(new Set());
  const currentRouteRef = useRef<string>("");

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // FAST polling (500ms): current editing block
  useEffect(() => {
    if (typeof logseq === "undefined") return;

    const fetchActiveBlock = async () => {
      try {
        const block = await logseq.Editor.getCurrentBlock();
        setActiveBlockUuid(block?.uuid ?? null);
      } catch {
        setActiveBlockUuid(null);
      }
    };

    fetchActiveBlock();
    const id = setInterval(fetchActiveBlock, 500);
    return () => clearInterval(id);
  }, []);

  // MEDIUM polling (2s): visible blocks + route changes
  const fetchVisibleBlocks = useCallback(async () => {
    if (typeof logseq === "undefined") return;

    try {
      const allUuids = new Set<string>();

      // Helper to recursively extract UUIDs
      function extractUuids(blocks: BlockEntity[]): Set<string> {
        const uuids = new Set<string>();
        function traverse(block: BlockEntity) {
          uuids.add(block.uuid);
          if (block.children) {
            for (const child of block.children) {
              traverse(child);
            }
          }
        }
        for (const block of blocks) {
          traverse(block);
        }
        return uuids;
      }

      // Try to get blocks from the current route's page
      let pageName: string | null = null;
      const routePath = currentRouteRef.current;
      const match = routePath.match(/^\/page\/(.+)$/);
      if (match) {
        pageName = decodeURIComponent(match[1]);
      }

      // If no route page, fall back to today's journal page
      if (!pageName) {
        const configs = await logseq.App.getUserConfigs();
        const dateFormat = configs.preferredDateFormat || "MMM do, yyyy";
        pageName = formatLogseqDate(new Date(), dateFormat);
      }

      if (pageName) {
        const mainBlocks = await logseq.Editor.getPageBlocksTree(pageName);
        if (mainBlocks && Array.isArray(mainBlocks)) {
          for (const uuid of extractUuids(mainBlocks as BlockEntity[])) {
            allUuids.add(uuid);
          }
        }
      }

      // Fetch sidebar items
      const sidebarItems =
        ((await logseq.App.getStateFromStore("ui/sidebar-open-blocks")) as SidebarItem[] | null) || [];

      if (Array.isArray(sidebarItems)) {
        const sidebarBlocksPromises = sidebarItems.map(async (item) => {
          try {
            if (item?.type === "page" && item?.uuid) {
              const page = (await logseq.Editor.getPage(item.uuid)) as PageEntity | null;
              if (page?.name) {
                return await logseq.Editor.getPageBlocksTree(page.name);
              }
            } else if (item?.type === "block" && item?.uuid) {
              const block = await logseq.Editor.getBlock(item.uuid, {
                includeChildren: true,
              });
              return block ? [block] : [];
            }
          } catch {
            // Silently ignore - item might no longer exist
          }
          return [];
        });

        const sidebarBlocks = await Promise.all(sidebarBlocksPromises);
        for (const blocks of sidebarBlocks) {
          if (Array.isArray(blocks)) {
            for (const uuid of extractUuids(blocks as BlockEntity[])) {
              allUuids.add(uuid);
            }
          }
        }
      }

      setVisibleUuids(allUuids);
      setLoading((prev) => ({ ...prev, visible: false }));
    } catch (err) {
      console.error("[BlockContext] Failed to fetch visible blocks:", err);
    }
  }, []);

  useEffect(() => {
    fetchVisibleBlocks();
    const intervalId = setInterval(fetchVisibleBlocks, 2000);

    let unhook: (() => void) | undefined;
    if (typeof logseq !== "undefined" && logseq.App?.onRouteChanged) {
      unhook = logseq.App.onRouteChanged(({ path }) => {
        currentRouteRef.current = path;
        fetchVisibleBlocks();
      });
    }

    return () => {
      clearInterval(intervalId);
      if (unhook) unhook();
    };
  }, [fetchVisibleBlocks]);

  // SLOW polling (5s): ALL task data in parallel
  const fetchAllTasks = useCallback(async () => {
    if (typeof logseq === "undefined") return;

    try {
      // Run all queries in parallel
      const [nowResults, waitingResults, snoozedResults, doneResults, activeResults, todayResults] =
        await Promise.all([
          logseq.DB.q("(task NOW)"),
          logseq.DB.q("(task WAITING)"),
          logseq.DB.q("(property snoozed-until)"),
          logseq.DB.q("(task DONE)"),
          logseq.DB.q("(task NOW LATER WAITING)"),
          fetchTodayTasks(),
        ]);

      // Process NOW tasks
      const processedNow: NowTask[] = [];
      if (nowResults && Array.isArray(nowResults)) {
        for (const block of nowResults as any[]) {
          const { parentUuid, parentContent } = await fetchParentInfo(block.uuid);
          processedNow.push({
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            parentUuid,
            parentContent,
          });
        }
        processedNow.sort(compareNowTasks);
      }
      setNowTasks(deduplicateHierarchy(processedNow));
      setLoading((prev) => ({ ...prev, now: false }));

      // Process WAITING tasks
      const processedWaiting: WaitingTask[] = [];
      if (waitingResults && Array.isArray(waitingResults)) {
        for (const block of waitingResults as any[]) {
          const { parentUuid, parentContent } = await fetchParentInfo(block.uuid);
          processedWaiting.push({
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            parentUuid,
            parentContent,
            scheduledDate: parseScheduledDate(block.content || ""),
          });
        }
        processedWaiting.sort((a, b) => {
          if (a.scheduledDate && b.scheduledDate) {
            return a.scheduledDate.getTime() - b.scheduledDate.getTime();
          }
          if (a.scheduledDate) return -1;
          if (b.scheduledDate) return 1;
          return 0;
        });
      }
      setWaitingTasks(deduplicateHierarchy(processedWaiting));
      setLoading((prev) => ({ ...prev, waiting: false }));

      // Process SNOOZED tasks
      const processedSnoozed: SnoozedTask[] = [];
      if (snoozedResults && Array.isArray(snoozedResults)) {
        for (const block of snoozedResults as any[]) {
          const content = block.content || "";
          const status = getTaskStatus(content);

          // Skip DONE tasks, track them for delayed cleanup
          if (status === null) {
            const existing = doneTasksRef.current.get(block.uuid);
            if (!existing) {
              doneTasksRef.current.set(block.uuid, {
                content,
                doneAt: Date.now(),
              });
            }
            continue;
          }

          doneTasksRef.current.delete(block.uuid);

          const snoozeInfo = getSnoozeInfo({
            uuid: block.uuid,
            content,
            properties: block.properties,
          });

          if (snoozeInfo) {
            const { parentUuid, parentContent } = await fetchParentInfo(block.uuid);
            processedSnoozed.push({
              uuid: block.uuid,
              content,
              pageId: block.page?.id || 0,
              snoozeUntil: snoozeInfo.until,
              snoozedAt: snoozeInfo.createdAt,
              isResurfaced: isResurfaced(snoozeInfo),
              snoozeDisplayText: getSnoozeDisplayText(snoozeInfo),
              snoozedAtDisplayText: getSnoozedAtDisplayText(snoozeInfo),
              parentUuid,
              parentContent,
            });
          }
        }

        // Sort: resurfaced first (oldest resurface time first), then pending (soonest first)
        processedSnoozed.sort((a, b) => {
          if (a.isResurfaced && !b.isResurfaced) return -1;
          if (!a.isResurfaced && b.isResurfaced) return 1;
          return a.snoozeUntil.getTime() - b.snoozeUntil.getTime();
        });
      }
      setSnoozedTasks(deduplicateHierarchy(processedSnoozed));
      setLoading((prev) => ({ ...prev, snoozed: false }));

      // Process DONE tasks
      const processedDone: DoneTask[] = [];
      if (doneResults && Array.isArray(doneResults)) {
        for (const block of doneResults as any[]) {
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
          processedDone.push({ uuid: block.uuid, parentUuid });
        }
      }
      setDoneTasks(processedDone);
      setLoading((prev) => ({ ...prev, done: false }));

      // Store active task UUIDs (for ancestor computation)
      if (activeResults && Array.isArray(activeResults)) {
        setActiveTaskUuids(new Set((activeResults as any[]).map((b) => b.uuid)));
      }

      // Set today data
      setTodayData(todayResults);
      setLoading((prev) => ({ ...prev, today: false }));
    } catch (err) {
      console.error("[BlockContext] Failed to fetch tasks:", err);
    }
  }, []);

  // Helper function to fetch today's tasks (extracted from useTodayTasks)
  async function fetchTodayTasks(): Promise<TodayTasksData> {
    try {
      const configs = await logseq.App.getUserConfigs();
      const dateFormat = configs.preferredDateFormat || "MMM do, yyyy";
      const today = new Date();
      const pageName = formatLogseqDate(today, dateFormat);

      const pageBlocks = await logseq.Editor.getPageBlocksTree(pageName);
      if (!pageBlocks || !Array.isArray(pageBlocks)) {
        return { nowTasks: [], todoLaterTasks: [], waitingTasks: [] };
      }

      // Flatten blocks helper
      function flattenBlocks(
        blocks: BlockEntity[],
        parentUuid?: string,
        parentContent?: string
      ): Array<BlockEntity & { parentUuid?: string; parentContent?: string }> {
        const result: Array<BlockEntity & { parentUuid?: string; parentContent?: string }> = [];
        function traverse(block: BlockEntity, parentUuid?: string, parentContent?: string) {
          result.push({ ...block, parentUuid, parentContent });
          if (block.children) {
            for (const child of block.children) {
              traverse(child as BlockEntity, block.uuid, block.content);
            }
          }
        }
        for (const block of blocks) {
          traverse(block, parentUuid, parentContent);
        }
        return result;
      }

      const flatBlocks = flattenBlocks(pageBlocks as BlockEntity[]);

      // Collect block references
      const referencedUuids = new Set<string>();
      for (const block of flatBlocks) {
        const refs = extractBlockReferences(block.content || "");
        refs.forEach((uuid) => referencedUuids.add(uuid));
      }

      // Fetch referenced blocks
      const referencedBlocks: BlockEntity[] = [];
      for (const uuid of referencedUuids) {
        try {
          const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
          if (block) {
            referencedBlocks.push(block as BlockEntity);
          }
        } catch {
          // Block might not exist
        }
      }

      const flattenedReferencedBlocks = flattenBlocks(referencedBlocks);

      // Build task map
      const taskMap = new Map<string, TodayTask>();

      for (const block of flatBlocks) {
        const status = getTaskStatus(block.content || "");
        if (status) {
          taskMap.set(block.uuid, {
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            status,
            isReferenced: false,
            createdAt: block.id,
            parentUuid: block.parentUuid,
            parentContent: block.parentContent,
          });
        }
      }

      for (const block of flattenedReferencedBlocks) {
        const status = getTaskStatus(block.content || "");
        if (status && !taskMap.has(block.uuid)) {
          taskMap.set(block.uuid, {
            uuid: block.uuid,
            content: block.content || "",
            pageId: block.page?.id || 0,
            status,
            isReferenced: true,
            createdAt: block.id,
            parentUuid: block.parentUuid,
            parentContent: block.parentContent,
          });
        }
      }

      // Group by status
      const now: TodayTask[] = [];
      const todoLater: TodayTask[] = [];
      const waiting: TodayTask[] = [];

      for (const task of taskMap.values()) {
        switch (task.status) {
          case "NOW":
            now.push(task);
            break;
          case "TODO":
          case "LATER":
            todoLater.push(task);
            break;
          case "WAITING":
            waiting.push(task);
            break;
        }
      }

      // Sort each group (simplified from useTodayTasks)
      now.sort(compareNowTasks);
      todoLater.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      waiting.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      return {
        nowTasks: deduplicateHierarchy(now),
        todoLaterTasks: deduplicateHierarchy(todoLater),
        waitingTasks: deduplicateHierarchy(waiting),
      };
    } catch {
      return { nowTasks: [], todoLaterTasks: [], waitingTasks: [] };
    }
  }

  // Initial fetch and periodic polling
  useEffect(() => {
    fetchAllTasks();
    const intervalId = setInterval(fetchAllTasks, 5000);
    return () => clearInterval(intervalId);
  }, [fetchAllTasks]);

  // Compute ancestors of active blocks
  useEffect(() => {
    async function computeAncestors() {
      const resurfacedUuids = snoozedTasks.filter((t) => t.isResurfaced).map((t) => t.uuid);
      const allActiveUuids = [...activeTaskUuids, ...resurfacedUuids];

      if (allActiveUuids.length === 0) {
        setAncestorsOfActive(new Set());
        return;
      }

      const ancestors = await getAllAncestorUuids(allActiveUuids);
      setAncestorsOfActive(ancestors);
    }
    computeAncestors();
  }, [activeTaskUuids, snoozedTasks]);

  // Derived lists
  const resurfacedTasks = useMemo(
    () => snoozedTasks.filter((t) => t.isResurfaced),
    [snoozedTasks]
  );
  const pendingTasks = useMemo(
    () => snoozedTasks.filter((t) => !t.isResurfaced),
    [snoozedTasks]
  );

  // Show notifications for newly resurfaced tasks
  useEffect(() => {
    for (const task of resurfacedTasks) {
      if (!notifiedUuidsRef.current.has(task.uuid)) {
        const preview = getDisplayText(task.content).substring(0, 40) || "Untitled task";

        logseq.UI.showMsg(`Task resurfaced: ${preview}`, "info");

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Task Resurfaced", {
            body: preview,
            silent: false,
          });
        }

        notifiedUuidsRef.current.add(task.uuid);
      }
    }
  }, [resurfacedTasks]);

  // Clean up snooze properties from DONE tasks after 5 seconds
  useEffect(() => {
    const now = Date.now();
    for (const [uuid, info] of doneTasksRef.current) {
      if (now - info.doneAt >= 5000) {
        logseq.Editor.removeBlockProperty(uuid, "snoozed-until");
        logseq.Editor.removeBlockProperty(uuid, "snoozed-at");
        doneTasksRef.current.delete(uuid);
      }
    }
  }, [snoozedTasks]);

  // Mark all resurfaced as seen
  const markAllSeen = useCallback(() => {
    setSeenUuids(new Set(resurfacedTasks.map((t) => t.uuid)));
  }, [resurfacedTasks]);

  // Unread count
  const unreadCount = useMemo(
    () => resurfacedTasks.filter((t) => !seenUuids.has(t.uuid)).length,
    [resurfacedTasks, seenUuids]
  );

  // Memoize context value
  const value = useMemo<BlockContextValue>(
    () => ({
      nowTasks,
      waitingTasks,
      snoozedTasks,
      doneTasks,
      todayData,
      resurfacedTasks,
      pendingTasks,
      ancestorsOfActive,
      activeTaskUuids,
      visibleUuids,
      activeBlockUuid,
      loading,
      refetch: fetchAllTasks,
      refetchSnoozed: fetchAllTasks, // Same function now
      unreadCount,
      markAllSeen,
    }),
    [
      nowTasks,
      waitingTasks,
      snoozedTasks,
      doneTasks,
      todayData,
      resurfacedTasks,
      pendingTasks,
      ancestorsOfActive,
      activeTaskUuids,
      visibleUuids,
      activeBlockUuid,
      loading,
      fetchAllTasks,
      unreadCount,
      markAllSeen,
    ]
  );

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlockContext(): BlockContextValue {
  const ctx = useContext(BlockContext);
  if (!ctx) {
    throw new Error("useBlockContext must be used within BlockContextProvider");
  }
  return ctx;
}
