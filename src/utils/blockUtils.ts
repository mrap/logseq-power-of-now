export interface ParentInfo {
  parentUuid?: string;
  parentContent?: string;
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
