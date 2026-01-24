# 001: Snooze Feature

## Overview

The snooze feature allows users to temporarily defer a task and be reminded about it later. Similar to email snooze in Superhuman, users can quickly snooze any block using a keyboard shortcut and natural language duration input.

## User Stories

1. As a user, I want to snooze a task so I can focus on other work and be reminded later
2. As a user, I want to specify snooze duration naturally ("in 2 hours", "tomorrow", "next Monday")
3. As a user, I want to see all my snoozed items in one place
4. As a user, I want to be notified when a snoozed item resurfaces
5. As a user, I want to click on a resurfaced item to navigate to the original block

## Feature Components

### 1. Snooze Trigger

**Keyboard Shortcut**
- Register via `logseq.App.registerCommandPalette()`
- Triggered when cursor is on any block
- Opens snooze modal overlay

**Modal Interface**
- Single text input field for duration
- Auto-focus on open
- Submit on Enter, cancel on Escape
- Show parsed date preview as user types

### 2. Duration Input

Uses **chrono-node** library for natural language date parsing.

**Supported Formats:**

| Category | Examples |
|----------|----------|
| Minutes | `5m`, `5 mins`, `5 minutes`, `in 5 minutes` |
| Hours | `2h`, `2 hours`, `in 2 hours` |
| Days | `2 days`, `in 2 days`, `tomorrow` |
| Relative | `next week` (Monday), `next Friday`, `next month` |
| Absolute | `January 5th`, `Jan 5`, `1/5` |

**Parsing Behavior:**
- "next week" resolves to next Monday
- Absolute dates without year infer the next occurrence
- Invalid input shows error state

### 3. Block Decoration

Uses Logseq block properties for snooze metadata.

**Property Format:**
```
- NOW [#A] My task to complete
  snoozed-until:: 2026-01-25T14:00
  snoozed-at:: 2026-01-24T10:00
```

**Properties:**
- `snoozed-until`: ISO datetime when task should resurface
- `snoozed-at`: ISO datetime when snooze was created

**Benefits:**
- Native Logseq property queries work
- Properties are hidden in collapsed view
- Can query with `(property snoozed-until)`

### 4. Notification System

**Toast Notification**
- Use `logseq.UI.showMsg()` when snooze expires
- Message: "Task resurfaced: [task preview]"
- Shown during polling check (10-second interval)

**Panel Badge**
- Show count indicator on plugin panel header
- Number of resurfaced items needing attention
- Clears when user views resurfaced items

**Polling Logic:**
- Every 10 seconds, check for blocks where `snoozed-until < now`
- Track which blocks have already triggered notifications (avoid repeats)

### 5. Views

**Add "SNOOZED" View Tab**

Alongside existing NOW / WAITING / TODAY tabs.

**Snoozed Items Section:**
- Shows all blocks with `snoozed-until` property
- Sorted by resurface time (soonest first)
- Display: task content, time until resurface
- Dimmed/muted styling for items still snoozed

**Resurfaced Items Section:**
- Items where `snoozed-until` has passed
- Highlighted styling (more prominent than snoozed)
- Display: task content, time since resurfaced, when originally snoozed
- Click to navigate to source block

**Item Display:**
```
┌─────────────────────────────────────────┐
│ [#A] Review quarterly report            │
│ Resurfaced 5 mins ago • Snoozed 2h ago  │
└─────────────────────────────────────────┘
```

## Technical Implementation Notes

### Dependencies
- Add `chrono-node` package for date parsing

### New Files
- `src/components/SnoozeModal.tsx` - Modal UI component
- `src/components/SnoozedTaskItem.tsx` - Snoozed item display
- `src/hooks/useSnoozedTasks.ts` - Query and poll snoozed blocks
- `src/utils/snooze.ts` - Snooze parsing and property management

### Modified Files
- `src/main.tsx` - Register keyboard shortcut
- `src/App.tsx` - Add SNOOZED view tab, badge indicator
- `src/index.css` - Modal and badge styles

### Logseq APIs Used
- `logseq.App.registerCommandPalette()` - Register shortcut
- `logseq.Editor.getCurrentBlock()` - Get focused block
- `logseq.Editor.upsertBlockProperty()` - Set snooze properties
- `logseq.Editor.removeBlockProperty()` - Clear snooze (on complete)
- `logseq.DB.q()` - Query blocks with snooze properties
- `logseq.UI.showMsg()` - Toast notifications

### Edge Cases
- User snoozes already-snoozed block: update existing snooze
- User completes snoozed task: remove snooze properties
- Plugin reload: re-check for resurfaced items on init
- Offline gaps: show all resurfaced items accumulated during offline period
