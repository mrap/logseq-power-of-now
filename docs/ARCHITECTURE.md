# Logseq Power of Now - Architecture

Technical documentation for developers working on this codebase.

## Directory Structure

```
src/
├── main.tsx              # Entry point - dual mode, keyboard shortcuts, CSS injection
├── App.tsx               # Main component - view tabs, modal management, state
├── components/
│   ├── TaskItem.tsx      # Base component with slots for customization
│   ├── NowTaskItem.tsx   # NOW-specific wrapper (elapsed time, priority)
│   ├── WaitingTaskItem.tsx   # WAITING-specific (scheduled date)
│   ├── TodayTaskItem.tsx     # TODAY-specific (marker badge)
│   ├── SnoozedTaskItem.tsx   # SNOOZED-specific (action buttons)
│   ├── SnoozeModal.tsx   # Natural language snooze input
│   └── EstimateModal.tsx # Time estimate input
├── hooks/
│   ├── usePolling.ts     # Generic polling with retry logic
│   ├── useTaskQuery.ts   # Query wrapper with sorting/deduplication
│   ├── useNowTasks.ts    # NOW task fetching
│   ├── useWaitingTasks.ts    # WAITING task fetching
│   ├── useTodayTasks.ts      # Today's journal tasks
│   ├── useSnoozedTasks.ts    # Snoozed task management
│   ├── useHideBlocks.ts      # CSS injection for focus mode
│   └── useVisibleBlocks.ts   # Track currently visible blocks
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

### 1. Hook Composition

Layered hook architecture for data fetching:

```
usePolling           # Core: interval polling with retry
    ↓
useTaskQuery         # Layer: query, map, sort, deduplicate
    ↓
useNowTasks          # Feature: specific query + comparator
useWaitingTasks
useTodayTasks
useSnoozedTasks
```

Each feature hook is minimal - just specifies the Datalog query and comparator function.

### 2. Slot-based Components

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

### 3. Props + Custom Events

No React Context is used. Cross-component communication uses:

- **Props drilling** for parent → child data flow
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

### 4. Hierarchy Deduplication

When both a parent and child task match a query, the parent is hidden to reduce noise:

```tsx
// hierarchyUtils.ts
function deduplicateHierarchy(tasks: BaseTask[]): BaseTask[] {
  const uuidSet = new Set(tasks.map(t => t.uuid));
  return tasks.filter(t => !t.parentUuid || !uuidSet.has(t.parentUuid));
}
```

### 5. CSS Injection

`useHideBlocks` dynamically injects CSS to hide blocks and add visual styling:

```tsx
useEffect(() => {
  const css = pendingTasks
    .map(t => `.ls-block[blockid="${t.uuid}"] { display: none !important; }`)
    .join("\n");
  logseq.provideStyle({ key: "hide-blocks", style: css });
}, [pendingTasks]);
```

Parent badges are injected using `logseq.provideUI()`.

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
│                         Hooks                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  usePolling  │◄───│ useTaskQuery │    │useHideBlocks │  │
│  │  (5s poll)   │    │              │    │  (CSS inj)   │──┼──►
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                              │
│         ▼                   ▼                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ useNowTasks │ useWaitingTasks │ useTodayTasks │... │    │
│  └────────────────────────────────────────────────────┘    │
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
| `main.tsx:74-176` | Keyboard shortcut registration |
| `main.tsx:188-239` | Priority update logic |
| `App.tsx:32-56` | Hook usage and state management |
| `App.tsx:98-146` | Snooze and estimate handlers |
| `useTaskQuery.ts:26-59` | Generic task query pattern |
| `useHideBlocks.ts:258-383` | CSS generation for hiding |
| `TaskItem.tsx:36-144` | Base component with slots |
| `taskComparators.ts` | Sorting logic per task type |
| `hierarchyUtils.ts` | Parent-child deduplication |
