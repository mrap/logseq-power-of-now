export interface ParentInfo {
  parentUuid?: string;
  parentContent?: string;
}

export interface BlockContent {
  content: string;
  parentUuid?: string;
}

/**
 * Fetches block content and parent info for a set of block UUIDs.
 * Used to scan visible blocks for references to hidden tasks.
 */
export async function fetchBlockContents(
  uuids: Set<string>
): Promise<Map<string, BlockContent>> {
  const results = new Map<string, BlockContent>();

  for (const uuid of uuids) {
    try {
      const block = await logseq.Editor.getBlock(uuid);
      if (block) {
        let parentUuid: string | undefined;
        if (block.parent?.id) {
          const parentBlock = await logseq.Editor.getBlock(block.parent.id);
          parentUuid = parentBlock?.uuid;
        }
        results.set(uuid, {
          content: block.content || "",
          parentUuid,
        });
      }
    } catch {
      // Block may not exist
    }
  }

  return results;
}

/**
 * Fetches parent block info for a given block UUID.
 * Returns empty object if parent is a page (not a block) or doesn't exist.
 */
export async function fetchParentInfo(blockUuid: string): Promise<ParentInfo> {
  const fullBlock = await logseq.Editor.getBlock(blockUuid);
  if (!fullBlock?.parent?.id) return {};

  try {
    const parentBlock = await logseq.Editor.getBlock(fullBlock.parent.id);
    if (parentBlock) {
      return {
        parentUuid: parentBlock.uuid,
        parentContent: parentBlock.content,
      };
    }
  } catch {
    // Parent might be a page, not a block
  }
  return {};
}

/**
 * Gets all ancestor UUIDs for a given block by walking up the tree.
 * Returns a Set of parent UUIDs (not including the block itself).
 */
export async function getAncestorUuids(blockUuid: string): Promise<Set<string>> {
  const ancestors = new Set<string>();
  let currentUuid = blockUuid;
  let depth = 0;
  const maxDepth = 50; // safety limit

  while (depth < maxDepth) {
    const { parentUuid } = await fetchParentInfo(currentUuid);
    if (!parentUuid) break;
    ancestors.add(parentUuid);
    currentUuid = parentUuid;
    depth++;
  }
  return ancestors;
}

/**
 * Gets all ancestor UUIDs for multiple blocks.
 * Returns a Set containing all unique ancestors across all blocks.
 */
export async function getAllAncestorUuids(blockUuids: string[]): Promise<Set<string>> {
  const ancestorSets = await Promise.all(blockUuids.map(getAncestorUuids));
  const allAncestors = new Set<string>();
  for (const set of ancestorSets) {
    set.forEach((a) => allAncestors.add(a));
  }
  return allAncestors;
}
