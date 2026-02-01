# Logseq Power of Now - Architecture

Technical documentation for developers working on this codebase.

## Directory Structure

```
src/
├── main.tsx              # Entry point - dual mode, keyboard shortcuts, CSS injection
├── App.tsx               # Main component - view tabs, modal management, state
├── contexts/
│   └── BlockContext.tsx  # Centralized data fetching (3 polling loops)
├── components/
│   ├── TaskItem.tsx      # Base component with slots for customization
│   ├── NowTaskItem.tsx   # NOW-specific wrapper (elapsed time, priority)
│   ├── WaitingTaskItem.tsx   # WAITING-specific (scheduled date)
│   ├── TodayTaskItem.tsx     # TODAY-specific (marker badge)
│   ├── SnoozedTaskItem.tsx   # SNOOZED-specific (action buttons)
│   ├── SnoozeModal.tsx   # Natural language snooze input
│   └── EstimateModal.tsx # Time estimate input
├── hooks/
│   ├── useNowTasks.ts    # Thin wrapper - extracts nowTasks from context
│   ├── useWaitingTasks.ts    # Thin wrapper - extracts waitingTasks from context
│   ├── useTodayTasks.ts      # Thin wrapper - extracts todayData from context
│   ├── useSnoozedTasks.ts    # Thin wrapper - extracts snoozed + notifications from context
│   ├── useHideBlocks.ts      # Consumer - reads context for CSS injection
│   ├── usePolling.ts     # Legacy - still used internally by BlockContext
│   ├── useTaskQuery.ts   # Legacy - logic moved to BlockContext
│   └── useVisibleBlocks.ts   # Legacy - logic moved to BlockContext
└── utils/
    ├── priority.ts       # Priority parsing and comparison
    ├── scheduling.ts     # SCHEDULED date parsing
    ├── timeTracking.ts   # LOGBOOK/CLOCK parsing
    ├── snooze.ts         # Snooze property parsing
    ├── estimate.ts       # Estimate property parsing
    ├── taskUtils.ts      # Content cleaning, display text
    ├── taskComparators.ts    # Sorting functions per task type
    ├── hierarchyUtils.ts     # Parent-child deduplication
    ├── blockUtils.ts     # Logseq API helpers
    ├── formatContent.tsx # Highlight rendering
    ├── formatElapsedTime.ts  # Duration formatting
    └── dateFormat.ts     # Date display formatting
```

---

## Key Patterns

### 1. BlockContext Architecture (Centralized Data)

All block data is fetched and managed by `BlockContextProvider` with **3 coordinated polling loops**:

```
BlockContextProvider (src/contexts/BlockContext.tsx)
├── FAST poll (500ms): activeBlockUuid
│   └── logseq.Editor.getCurrentBlock()
│
├── MEDIUM poll (2s): visibleUuids + route listener
│   ├── logseq.Editor.getPageBlocksTree() (current page)
│   ├── logseq.App.getStateFromStore("ui/sidebar-open-blocks")
│   └── logseq.App.onRouteChanged() (listener)
│
└── SLOW poll (5s): ALL task data in parallel (Promise.all)
    ├── logseq.DB.q("(task NOW)")
    ├── logseq.DB.q("(task WAITING)")
    ├── logseq.DB.q("(task DONE)")
    ├── logseq.DB.q("(property snoozed-until)")
    ├── logseq.DB.q("(task NOW LATER WAITING)") for ancestors
    └── fetchTodayTasks() (today's journal page)

    ↓ Process all data together

    ↓ Single atomic setState (deterministic)

    Derived state (computed once, used everywhere):
    ├── resurfacedTasks / pendingTasks split
    ├── ancestorsOfActive (for hiding logic)
    └── parent info for each task
```

**Benefits:**
- **Single source of truth** - no duplicate queries or state
- **Deterministic updates** - CSS and UI always see same data snapshot
- **~50% fewer API calls** - was 11 independent loops, now 3 coordinated loops
- **No race conditions** - all task data updates atomically
- **Ancestor filtering** computed once in context, ensures parent-child visibility works correctly

**Context Interface:**
```typescript
interface BlockContextValue {
  // Raw task arrays
  nowTasks: NowTask[];
  waitingTasks: WaitingTask[];
  snoozedTasks: SnoozedTask[];
  doneTasks: DoneTask[];
  todayData: TodayTasksData;

  // Derived data (computed once)
  resurfacedTasks: SnoozedTask[];
  pendingTasks: SnoozedTask[];
  ancestorsOfActive: Set<string>;
  activeTaskUuids: Set<string>;

  // Context state
  visibleUuids: Set<string>;
  activeBlockUuid: string | null;

  // Actions
  refetch: () => Promise<void>;
  refetchSnoozed: () => Promise<void>;

  // Snoozed notifications
  unreadCount: number;
  markAllSeen: () => void;
}
```

### 2. Hook Composition (Thin Wrappers)

Hooks are now minimal wrappers that consume BlockContext. This maintains backward compatibility while eliminating duplicate polling:

```
BlockContext            # Core: unified polling, derived state
    ↓
useNowTasks             # Wrapper: extracts nowTasks from context (10 lines)
useWaitingTasks         # Wrapper: extracts waitingTasks from context (13 lines)
useSnoozedTasks         # Wrapper: extracts snoozed + notification state (23 lines)
useTodayTasks           # Wrapper: extracts todayData from context (16 lines)
useHideBlocks           # Consumer: reads context for CSS generation (NO polling)
```

**Example wrapper:**
```tsx
// hooks/useNowTasks.ts
export function useNowTasks() {
  const { nowTasks, loading, refetch } = useBlockContext();
  return {
    tasks: nowTasks,
    loading: loading.now,
    error: null,
    refetch,
  };
}
```

**Migration notes:**
- `usePolling` and `useTaskQuery` still exist but are no longer used by feature hooks
- All feature hooks now delegate to BlockContext
- Components using hooks see no API changes

### 3. Slot-based Components

`TaskItem` is a flexible base component with customization slots:

```tsx
<TaskItem
  uuid={task.uuid}
  content={task.content}
  pageId={task.pageId}
  leftSlot={<ElapsedTime minutes={task.elapsedMinutes} />}
  rightSlot={<ActionButtons onSnooze={...} />}
  secondaryText="Scheduled: tomorrow"
  variant="resurfaced"
/>
```

Feature-specific wrappers (`NowTaskItem`, `WaitingTaskItem`, etc.) compose these slots.

### 4. BlockContext + Custom Events

Cross-component communication uses:

- **BlockContext** for shared data (task queries, visible blocks, active block, derived state)
- **Custom DOM events** for keyboard shortcuts (main.tsx → App.tsx)

```tsx
// main.tsx - dispatch event
window.dispatchEvent(new CustomEvent("power-of-now:snooze-block", { detail: {...} }));

// App.tsx - listen
useEffect(() => {
  const handler = (e) => setSnoozeTarget(e.detail);
  window.addEventListener("power-of-now:snooze-block", handler);
  return () => window.removeEventListener("power-of-now:snooze-block", handler);
}, []);
```

### 5. Hierarchy Deduplication

When both a parent and child task match a query, the parent is hidden to reduce noise:

```tsx
// hierarchyUtils.ts
function deduplicateHierarchy(tasks: BaseTask[]): BaseTask[] {
  const uuidSet = new Set(tasks.map(t => t.uuid));
  return tasks.filter(t => !t.parentUuid || !uuidSet.has(t.parentUuid));
}
```

### 6. CSS Injection

`useHideBlocks` consumes data from BlockContext (no independent polling) and dynamically injects CSS:

```tsx
export function useHideBlocks(enabled: boolean, nowTaskUuids: string[] = []) {
  // Get all data from context (single source of truth)
  const {
    pendingTasks,
    resurfacedTasks,
    doneTasks,
    visibleUuids,
    activeBlockUuid,
    ancestorsOfActive,
  } = useBlockContext();

  // Generate CSS based on context data
  const css = useMemo(() => {
    const hiddenDoneUuids = doneTasks
      .filter(t => !ancestorsOfActive.has(t.uuid))
      .map(t => `.ls-block[blockid="${t.uuid}"] { display: none !important; }`)
      .join("\n");
    // ... more CSS rules
    return hiddenDoneUuids;
  }, [doneTasks, ancestorsOfActive, pendingTasks, ...]);

  useEffect(() => {
    logseq.provideStyle({ key: "hide-blocks", style: css });
  }, [css]);
}
```

**Key change:** CSS now updates in the same render cycle as the UI because both read from the same BlockContext state snapshot. This eliminates race conditions where CSS could lag behind UI updates.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Logseq                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   DB.q()     │    │ Editor API   │    │  provideUI   │  │
│  │   queries    │    │  updates     │    │  provideStyle│  │
│  └──────┬───────┘    └──────▲───────┘    └──────▲───────┘  │
└─────────┼───────────────────┼───────────────────┼──────────┘
          │                   │                   │
          ▼                   │                   │
┌─────────────────────────────────────────────────────────────┐
│                   BlockContextProvider                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FAST poll (500ms):  activeBlockUuid                 │   │
│  │  MEDIUM poll (2s):   visibleUuids + route listener   │   │
│  │  SLOW poll (5s):     ALL task queries (Promise.all)  │   │
│  │                                                       │   │
│  │  ↓ Single atomic setState                            │   │
│  │                                                       │   │
│  │  State: nowTasks, waitingTasks, snoozedTasks,        │   │
│  │         doneTasks, todayData, resurfacedTasks,       │   │
│  │         pendingTasks, ancestorsOfActive, etc.        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Thin Hook Wrappers                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ useNowTasks  │  │useWaitingTasks│ │useSnoozedTasks│     │
│  │  (10 lines)  │  │  (13 lines)   │ │  (23 lines)   │  ...│
│  └──────┬───────┘  └──────┬────────┘ └──────┬────────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────┴────────┐                        │
│                    │ useHideBlocks │                        │
│                    │ (CSS consumer)│──────────────────────► │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Components                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    App.tsx   │───►│   TaskItem   │◄───│  *TaskItem   │  │
│  │  (view tabs) │    │   (base)     │    │  (wrappers)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                       │          │
│         ▼                                       ▼          │
│  ┌──────────────┐                      ┌──────────────┐    │
│  │ SnoozeModal  │                      │ rightSlot    │    │
│  │ EstimateModal│                      │ leftSlot     │────┼──►
│  └──────────────┘                      └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key improvements over previous architecture:**
- All hooks read from same BlockContext state (deterministic)
- CSS generation uses same data snapshot as UI rendering (no lag)
- Ancestor filtering computed once in context (used by both UI and CSS)
- 3 polling loops instead of 11 (50% fewer API calls)

---

## Dual Mode Operation

The plugin runs in two modes:

### Plugin Mode (Production)
- Loaded via Logseq's plugin system
- Uses `@logseq/libs` directly
- Registers keyboard shortcuts via `registerCommandPalette`
- Renders in iframe positioned at bottom of Logseq window

### Browser Mode (Development)
- Uses `logseq-proxy` to proxy API calls to Logseq's HTTP API
- Requires enabling HTTP APIs server in Logseq settings
- Mock settings loaded from `mocks/settings.local.json`
- Hot module replacement via Vite

Mode is determined by `import.meta.env.VITE_MODE`.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `contexts/BlockContext.tsx` | Centralized data fetching (3 polling loops, single source of truth) |
| `main.tsx:74-176` | Keyboard shortcut registration |
| `main.tsx:246-258` | BlockContextProvider wrapper in renderApp() |
| `App.tsx:32-56` | Hook usage (thin wrappers consuming context) |
| `hooks/useHideBlocks.ts` | CSS generation consuming context (NO independent polling) |
| `hooks/useNowTasks.ts` | 10-line wrapper extracting nowTasks from context |
| `TaskItem.tsx:36-144` | Base component with slots |
| `taskComparators.ts` | Sorting logic per task type |
| `hierarchyUtils.ts` | Parent-child deduplication |
