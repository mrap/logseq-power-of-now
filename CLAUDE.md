# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Logseq Power of Now is a Logseq plugin that displays task aggregations from three sources: NOW tasks, WAITING tasks, and today's journal. It provides intelligent sorting, elapsed time tracking, and quick navigation to source blocks.

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
├── main.tsx          # Entry point - dual mode (web/plugin), iframe setup
├── App.tsx           # Main component with NOW/WAITING/TODAY view tabs
├── components/       # Task item components with click-to-navigate
├── hooks/            # Data fetching with Logseq.DB.q() and 10s polling
└── utils/            # Parsing for priorities, scheduling, LOGBOOK clocks
```

**Data flow**: Logseq.DB.q() queries → hooks with polling → parsed task data → components → Logseq.Editor API for updates

## Key Patterns

- **Task markers**: NOW, TODO, LATER, WAITING (Logseq-native)
- **Priority**: [#A], [#B], [#C] markers - sorting is A > B > C > none
- **Scheduling**: `SCHEDULED: <YYYY-MM-DD Day HH:MM>` format
- **Time tracking**: LOGBOOK section with CLOCK entries for elapsed time
- **Block references**: Extracted via `\(\(([a-f0-9-]{36})\)\)` regex

**Sorting rules**:
- NOW: priority, then elapsed time (longest first)
- WAITING: priority, then scheduled date (soonest first)
- TODO/LATER: priority, then creation time (oldest first)

## Release

Push to `main` branch triggers semantic-release CI which creates GitHub releases. Commit messages must follow [semantic-release](https://github.com/semantic-release/semantic-release) specification.
