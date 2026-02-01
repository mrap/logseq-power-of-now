# Logseq Power of Now

A Logseq plugin that keeps your active work visible. Surfaces NOW, WAITING, and today's tasks in a persistent bar with intelligent sorting, time tracking, and snooze capabilities.

## Features

- **4 View Tabs**: TODAY (journal tasks), NOW (active work), WAITING (blocked tasks), SNOOZED (deferred tasks)
- **Intelligent Sorting**: Priority (A > B > C), then elapsed time, scheduled date, or creation time
- **Snooze System**: Natural language input ("tomorrow 9am"), hide until due, resurface notifications
- **Time Tracking**: Displays elapsed time from Logseq's LOGBOOK/CLOCK entries
- **Focus Mode**: Hide DONE and snoozed blocks in main UI with expandable parent badges
- **Quick Actions**: Priority shortcuts, time estimates, click-to-navigate, shift-click for sidebar

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Snooze current block |
| `Ctrl+E` | Set time estimate |
| `Ctrl+1/2/3` | Set priority A/B/C |
| `Ctrl+`` ` | Remove priority |
| `Ctrl+,` | Toggle hidden blocks visibility |

## Installation

### From Marketplace

1. Open Logseq → Settings → Plugins → Marketplace
2. Search for "Power of Now"
3. Click Install

### Manual Installation

1. Download the latest release from [Releases](https://github.com/mrap/logseq-power-of-now/releases)
2. Extract to a folder
3. In Logseq: Settings → Plugins → Load unpacked plugin
4. Select the extracted folder

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (browser mode)
pnpm build:plugin     # Build for Logseq plugin
```

### Browser Mode Setup

Browser mode enables hot reload development without reloading the plugin.

1. Enable HTTP APIs server in Logseq settings
2. Set authorization token in Logseq
3. Configure environment:
   - `API_SERVER=http://127.0.0.1:12315`
   - `API_TOKEN=123`
4. Mock plugin settings via `mocks/settings.local.json`
5. Run `pnpm dev` and open `localhost:5173`

### Plugin Mode

For testing the actual plugin experience:

1. Run `pnpm build:plugin`
2. In Logseq: Settings → Plugins → Load unpacked plugin
3. Select the project folder

## Documentation

- [Product Specification](docs/PRODUCT.md) - Features, shortcuts, visual indicators
- [Architecture Guide](docs/ARCHITECTURE.md) - Codebase structure, patterns, data flow

## License

MIT
