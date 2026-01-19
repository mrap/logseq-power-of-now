const STORAGE_KEY = "power-of-now-task-times";

interface TaskTimes {
  [uuid: string]: number; // timestamp when task was first seen as NOW
}

/**
 * Get all tracked task start times from localStorage
 */
export function getTaskTimes(): TaskTimes {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save task times to localStorage
 */
function saveTaskTimes(times: TaskTimes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Get the start time for a specific task.
 * If not tracked yet, records the current time as the start.
 */
export function getTaskStartTime(uuid: string): number {
  const times = getTaskTimes();

  if (!times[uuid]) {
    times[uuid] = Date.now();
    saveTaskTimes(times);
  }

  return times[uuid];
}

/**
 * Remove tracking for tasks that are no longer NOW.
 * Call this with the current list of NOW task UUIDs to clean up stale entries.
 */
export function cleanupStaleTasks(currentNowUuids: string[]): void {
  const times = getTaskTimes();
  const currentSet = new Set(currentNowUuids);

  let changed = false;
  for (const uuid of Object.keys(times)) {
    if (!currentSet.has(uuid)) {
      delete times[uuid];
      changed = true;
    }
  }

  if (changed) {
    saveTaskTimes(times);
  }
}

/**
 * Get elapsed time in milliseconds for a task
 */
export function getElapsedTime(uuid: string): number {
  const startTime = getTaskStartTime(uuid);
  return Date.now() - startTime;
}
