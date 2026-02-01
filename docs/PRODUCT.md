# Logseq Power of Now - Product Specification

A task management plugin for Logseq that surfaces active work and helps you stay focused on what matters now.

## Core Features

### 4 View Tabs

| Tab | Description |
|-----|-------------|
| **TODAY** | Tasks from today's journal page, grouped by status (NOW, TODO/LATER, WAITING) |
| **NOW** | All NOW tasks across the graph, sorted by priority then elapsed time |
| **WAITING** | All WAITING tasks across the graph, sorted by priority then scheduled date |
| **SNOOZED** | Tasks with snooze properties, split into Resurfaced (past due) and Pending |

### Intelligent Sorting

Tasks are sorted by priority first (A > B > C > none), then by context-specific secondary criteria:

- **NOW tasks**: Elapsed time (longest first) - tasks you've been working on bubble up
- **WAITING tasks**: Scheduled date (soonest first) - upcoming deadlines surface
- **TODO/LATER tasks**: Creation time (oldest first) - prevents tasks from being forgotten

### Snooze System

Temporarily hide tasks until a specified time:

- Natural language input via `chrono-node` ("tomorrow", "in 2 hours", "next monday 9am")
- Snoozed blocks are hidden from Logseq's main UI with visual indicator
- Resurfaced tasks show red highlighting and notification badge
- Re-snooze buttons for quick postponement

### Time Tracking

Displays elapsed time from Logseq's native LOGBOOK/CLOCK entries:

```
:LOGBOOK:
CLOCK: [2024-01-15 Mon 09:00]--[2024-01-15 Mon 10:30]
:END:
```

Shows as "1h 30m" in the task list.

### Focus Mode

Hide completed and snoozed blocks in Logseq's main UI:

- Injects CSS to hide DONE tasks and pending snoozed blocks
- Parent blocks show badges with hidden children count ("3 done, 1 snoozed")
- Click badges to expand/reveal hidden children
- Toggle visibility with keyboard shortcut or eye icon button

### Quick Actions

- **Priority shortcuts**: Set A/B/C priority on current block
- **Estimate button**: Set time estimates stored as block properties
- **Complete checkbox**: Mark tasks as DONE directly from the plugin
- **Navigate**: Click to scroll to block, Shift-click to open in sidebar

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Snooze current block |
| `Ctrl+E` | Set time estimate |
| `Ctrl+1` | Set priority A |
| `Ctrl+2` | Set priority B |
| `Ctrl+3` | Set priority C |
| `Ctrl+`` ` | Remove priority |
| `Ctrl+,` | Toggle hidden blocks visibility |

---

## Task Properties

The plugin uses Logseq block properties for persistence:

| Property | Format | Purpose |
|----------|--------|---------|
| `snoozed-until` | ISO 8601 datetime | When the task should resurface |
| `snoozed-at` | ISO 8601 datetime | When the snooze was set |
| `estimated-time` | Integer (minutes) | Time estimate for the task |

---

## Visual Indicators

### In Plugin Bar

- **Task counts**: Badge showing number of tasks in each view
- **Unread badge**: Red badge on SNOOZED tab for new resurfaced tasks
- **Priority pills**: Color-coded A/B/C indicators
- **Elapsed time**: Gray text showing time tracked
- **Scheduled date**: Shows when WAITING tasks are due

### In Logseq Main UI

- **NOW blocks**: Green/emerald left border and background with glowing bullet ring and subtle pulse animation - makes active work immediately recognizable
- **Resurfaced blocks**: Red left border and background, glowing bullet ring
- **Pending snoozed blocks**: Gray styling when expanded (normally hidden)
- **Estimate indicator**: Blue ring around bullet for blocks with estimates
- **Hidden badges**: Parent blocks show expandable count of hidden children

---

## Task Markers

The plugin respects Logseq's native task markers:

- `NOW` - Active work, highest visibility
- `TODO` - Planned work
- `LATER` - Deferred work
- `WAITING` - Blocked on external input
- `DONE` - Completed (hidden in focus mode)
