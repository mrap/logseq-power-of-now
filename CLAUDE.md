# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Logseq Power of Now is a Logseq plugin that surfaces active work in a persistent bottom bar. It displays tasks from four sources: NOW tasks, WAITING tasks, today's journal, and snoozed tasks with intelligent sorting, time tracking, and focus mode features.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server in browser mode (localhost:5173)
pnpm build:plugin     # Build for Logseq plugin (tsc + vite build)
pnpm build:web        # Build for web mode
```

**Browser mode setup**: Requires enabling HTTP APIs server in Logseq settings with API_SERVER=http://127.0.0.1:12315 and API_TOKEN=123. Mock plugin settings via `mocks/settings.local.json`.

**Plugin mode**: Run `pnpm build:plugin`, then load unpacked plugin folder in Logseq.

## Architecture

```
src/
├── main.tsx          # Entry point - dual mode, keyboard shortcuts, CSS injection
├── App.tsx           # Main component - view tabs (TODAY/NOW/WAITING/SNOOZED)
├── contexts/         # BlockContext - centralized data fetching
├── components/       # TaskItem base + task-specific wrappers
├── hooks/            # Thin wrappers around BlockContext
└── utils/            # Parsing, sorting, formatting utilities
```

**Data flow**: `BlockContextProvider` → unified polling (3 loops: 500ms, 2s, 5s) → all hooks consume context → components render → `Logseq.Editor` API for updates

## Key Engineering Patterns

### BlockContext Architecture (Centralized Data)

All block data is fetched and managed by `BlockContextProvider`:

```
BlockContextProvider
├── FAST poll (500ms): activeBlockUuid only
├── MEDIUM poll (2s): visibleUuids + route listener
└── SLOW poll (5s, parallel Promise.all):
    ├── (task NOW)
    ├── (task WAITING)
    ├── (task DONE)
    ├── (property snoozed-until)
    └── (task NOW LATER WAITING) for ancestors

    ↓ Single atomic setState

    Derived state (computed once):
    ├── resurfacedTasks / pendingTasks
    ├── ancestorsOfActive
    └── parent info for all tasks
```

**Benefits:**
- Single source of truth - no duplicate polling
- Deterministic updates - CSS and UI always in sync
- ~50% fewer API calls vs previous architecture
- Ancestor filtering computed once, used everywhere

### Hook Composition (Thin Wrappers)

Hooks are now minimal wrappers that consume BlockContext:

```
BlockContext         # Core: unified polling, derived state
    ↓
useNowTasks          # Wrapper: extracts nowTasks from context
useWaitingTasks      # Wrapper: extracts waitingTasks from context
useSnoozedTasks      # Wrapper: extracts snoozed + notification state
useTodayTasks        # Wrapper: extracts todayData from context
useHideBlocks        # Consumer: reads context for CSS generation
```

### Slot-based Components
`TaskItem` provides `leftSlot`, `rightSlot`, and `secondaryText` props. Feature wrappers (`NowTaskItem`, `WaitingTaskItem`, etc.) compose these slots.

### Cross-component Communication
- BlockContext for shared data (all task queries, visible blocks, active block)
- Custom DOM events for keyboard shortcuts (main.tsx dispatches, App.tsx listens)

### Hierarchy Deduplication
When parent and child both match a query, parent is hidden (`hierarchyUtils.ts`).

### CSS Injection
`useHideBlocks` consumes data from BlockContext (no independent polling), generates CSS to hide done/snoozed blocks, injects via `logseq.provideStyle()`. Ensures CSS and UI update together in same render cycle.

## Keyboard Shortcuts

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Ctrl+S` | Snooze block | `main.tsx:74-95` |
| `Ctrl+E` | Set estimate | `main.tsx:98-119` |
| `Ctrl+1/2/3` | Priority A/B/C | `main.tsx:122-153` |
| `Ctrl+`` ` | Remove priority | `main.tsx:155-164` |
| `Ctrl+,` | Toggle visibility | `main.tsx:167-176` |

## Key Patterns

- **Task markers**: NOW, TODO, LATER, WAITING, DONE (Logseq-native)
- **Priority**: `[#A]`, `[#B]`, `[#C]` markers - sorting is A > B > C > none
- **Scheduling**: `SCHEDULED: <YYYY-MM-DD Day HH:MM>` format
- **Time tracking**: LOGBOOK section with CLOCK entries for elapsed time
- **Block references**: Extracted via `\(\(([a-f0-9-]{36})\)\)` regex
- **Snooze properties**: `snoozed-until`, `snoozed-at` (ISO 8601)
- **Estimate property**: `estimated-time` (minutes as integer)

**Sorting rules**:
- NOW: priority, then elapsed time (longest first)
- WAITING: priority, then scheduled date (soonest first)
- TODO/LATER: priority, then creation time (oldest first)

## Key Files

| File | Purpose |
|------|---------|
| `main.tsx:74-176` | Keyboard shortcut registration |
| `main.tsx:246-258` | BlockContextProvider wrapper in renderApp() |
| `contexts/BlockContext.tsx` | Centralized data fetching (3 polling loops, derived state) |
| `App.tsx:32-56` | Hook usage (thin wrappers consuming context) |
| `hooks/useHideBlocks.ts` | CSS generation consuming context (no polling) |
| `hooks/useNowTasks.ts` | Thin wrapper extracting nowTasks from context |
| `TaskItem.tsx` | Base component with slots |
| `taskComparators.ts` | Sorting logic per task type |

## Documentation Maintenance

**Keep documentation in sync with code changes.** When adding, changing, or removing features, update the relevant docs in the same commit.

### Documentation Files

| File | Purpose | Update When |
|------|---------|-------------|
| `docs/PRODUCT.md` | User-facing features, shortcuts, properties | Adding/changing user-visible behavior |
| `docs/ARCHITECTURE.md` | Engineering patterns, data flow, key files | Changing code structure or patterns |
| `README.md` | Installation, quick start, feature overview | Major feature additions |
| `CLAUDE.md` | Development guidance, patterns, key files | Changing development workflows or patterns |

### Writing Feature Documentation

Document features from the user's perspective:

1. **What it does** - One sentence describing the capability
2. **How to use it** - Keyboard shortcut, UI action, or workflow
3. **What happens** - Observable result or behavior change

Example for a new feature:
```markdown
### Quick Re-snooze
Re-snooze a resurfaced task with common time intervals.
- Click the re-snooze button on any resurfaced task in the SNOOZED view
- Choose from preset options: "1 hour", "Tomorrow 9am", "Next week"
- Task returns to pending state and disappears from resurfaced list
```

### Checklist for Feature Changes

**Adding a feature:**
- [ ] Add to `docs/PRODUCT.md` with user story format
- [ ] Add keyboard shortcut to shortcuts table (if applicable)
- [ ] Update `docs/ARCHITECTURE.md` if new patterns introduced
- [ ] Update `CLAUDE.md` Key Files table if new key files

**Changing a feature:**
- [ ] Update description in `docs/PRODUCT.md`
- [ ] Update any affected keyboard shortcuts
- [ ] Verify examples still accurate

**Removing a feature:**
- [ ] Remove from `docs/PRODUCT.md`
- [ ] Remove keyboard shortcut from tables
- [ ] Remove from `CLAUDE.md` if referenced

## Release

Push to `main` branch triggers semantic-release CI which creates GitHub releases. Commit messages must follow [semantic-release](https://github.com/semantic-release/semantic-release) specification.
