import { getDisplayText } from "./taskUtils";

/**
 * Base task interface with optional hierarchy info
 */
export interface BaseTask {
  uuid: string;
  content: string;
  parentUuid?: string; // Tree parent (from block.parent.id)
  parentContent?: string; // Content of parent block (for reference detection)
}

/**
 * Task with parent context added after deduplication
 */
export type TaskWithContext<T extends BaseTask> = T & {
  parentContext?: string;
};

/**
 * Regex to match block references ((uuid))
 */
const BLOCK_REF_REGEX = /\(\(([a-f0-9-]{36})\)\)/g;

/**
 * Check if content is ONLY a block reference (possibly with whitespace)
 */
function isOnlyBlockReference(content: string): string | null {
  const trimmed = content.trim();
  const match = trimmed.match(/^\(\(([a-f0-9-]{36})\)\)$/);
  return match ? match[1] : null;
}

/**
 * Extract all block reference UUIDs from content
 */
export function extractBlockReferences(content: string): string[] {
  const matches = [...content.matchAll(BLOCK_REF_REGEX)];
  return matches.map((m) => m[1]);
}

/**
 * Deduplicate tasks by hiding parents when their children are in the list.
 *
 * A task is considered a "parent" if:
 * 1. Its uuid is another task's parentUuid (tree hierarchy), OR
 * 2. Its content contains ((child-uuid)) where child-uuid is in the list (reference), OR
 * 3. A task's parent block contains ONLY ((parent-task-uuid)) - treat referenced task as parent
 *
 * Children get parentContext set to the display text of their parent.
 */
export function deduplicateHierarchy<T extends BaseTask>(
  tasks: T[]
): TaskWithContext<T>[] {
  if (tasks.length === 0) return [];

  // Build lookup structures
  const taskUuids = new Set(tasks.map((t) => t.uuid));
  const taskByUuid = new Map(tasks.map((t) => [t.uuid, t]));

  // Track which tasks are "parents" (have children in the list)
  const parentsWithChildren = new Set<string>();

  // Track child -> parent relationships for context
  const childToParent = new Map<string, string>();

  for (const task of tasks) {
    // Check tree hierarchy: if this task's parent is in the list
    if (task.parentUuid && taskUuids.has(task.parentUuid)) {
      parentsWithChildren.add(task.parentUuid);
      childToParent.set(task.uuid, task.parentUuid);
    }

    // Check if parent block contains ONLY a reference to a task in our list
    // (parent is not a task itself, but references one)
    // Only check this if the parent block is NOT itself a task in our list
    if (task.parentContent) {
      const parentIsTask = task.parentUuid && taskUuids.has(task.parentUuid);
      if (!parentIsTask) {
        const refUuid = isOnlyBlockReference(task.parentContent);
        if (refUuid && taskUuids.has(refUuid)) {
          // The parent block just contains ((refUuid)) - treat refUuid as the effective parent
          parentsWithChildren.add(refUuid);
          if (!childToParent.has(task.uuid)) {
            childToParent.set(task.uuid, refUuid);
          }
        }
      }
    }

    // Check reference relationship: if this task references another task
    const refs = extractBlockReferences(task.content);
    for (const refUuid of refs) {
      if (taskUuids.has(refUuid)) {
        // This task references another task - this task is the "parent"
        parentsWithChildren.add(task.uuid);
        // The referenced task is the "child"
        if (!childToParent.has(refUuid)) {
          childToParent.set(refUuid, task.uuid);
        }
      }
    }
  }

  // Filter out parents that have children in the list
  // Add parentContext to children
  return tasks
    .filter((task) => !parentsWithChildren.has(task.uuid))
    .map((task) => {
      const parentUuid = childToParent.get(task.uuid);
      let parentContext: string | undefined;

      if (parentUuid) {
        const parentTask = taskByUuid.get(parentUuid);
        if (parentTask) {
          parentContext = getDisplayText(parentTask.content);
        }
      }

      return { ...task, parentContext };
    });
}
