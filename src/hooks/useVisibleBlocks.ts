import { useState, useEffect, useCallback, useRef } from "react";
import { formatLogseqDate } from "../utils/dateFormat";

interface BlockEntity {
  uuid: string;
  children?: BlockEntity[];
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

/**
 * Recursively extracts all UUIDs from a block tree.
 */
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

/**
 * Parse page name from route path.
 * Route paths look like: /page/PageName or /page/Jan%2030th%2C%202026
 */
function parsePageNameFromRoute(path: string): string | null {
  // Match /page/PageName pattern
  const match = path.match(/^\/page\/(.+)$/);
  if (match) {
    // Decode URL-encoded characters
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Hook that tracks all visible block UUIDs from the current page and right sidebar.
 * Polls periodically to stay in sync with navigation and sidebar changes.
 */
export function useVisibleBlocks() {
  const [visibleUuids, setVisibleUuids] = useState<Set<string>>(new Set());
  const currentRouteRef = useRef<string>("");

  const fetchVisibleBlocks = useCallback(async () => {
    if (typeof logseq === "undefined") return;

    try {
      const allUuids = new Set<string>();

      // 1. Try to get blocks from the current route's page
      let pageName = parsePageNameFromRoute(currentRouteRef.current);

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

      // 2. Fetch Sidebar Items
      const sidebarItems =
        ((await logseq.App.getStateFromStore(
          "ui/sidebar-open-blocks"
        )) as SidebarItem[] | null) || [];

      // 3. Resolve Sidebar Trees based on item type
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
          } catch (err) {
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
    } catch (err) {
      console.error("[useVisibleBlocks] Failed to fetch visible blocks:", err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchVisibleBlocks();

    // Poll periodically (every 2 seconds for responsiveness)
    const intervalId = setInterval(fetchVisibleBlocks, 2000);

    // Listen for route changes to update immediately
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

  return { visibleUuids, refetch: fetchVisibleBlocks };
}
