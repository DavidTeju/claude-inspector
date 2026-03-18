# Claude Inspector

A local web UI for browsing, searching, and interacting with your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions. Claude Code stores all conversations as JSONL files in `~/.claude/projects/` — this app gives you a searchable, navigable interface to explore past sessions and run live ones.

## Features

- **Live sessions** — start new Claude Code sessions directly from the browser, or resume existing ones. Stream responses in real-time, answer permission requests, respond to questions, and track token costs — all through the web UI. Powered by the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk).

- **Full-text search** — a background reconciler indexes session metadata, message text, tool usage, branches, and token counts into a local SQLite database. Supports structured filters (`tool:Read`, `branch:main`, `is:subagent`, etc.) and sort by relevance, newest, or oldest. Results stream via SSE with highlighted match snippets. Falls back to [ripgrep](https://github.com/BurntSushi/ripgrep) for raw JSONL scanning with `mode:raw`.

- **Session viewer** — full conversation renderer with user/assistant threading, grouped consecutive assistant messages, collapsible tool calls with paired input/result, collapsible thinking blocks, syntax-highlighted code blocks (shiki), subagent badges with links to parent sessions, and token cost tracking.

- **Project browser** — lists all projects with session counts and relative timestamps
- **Session list** — sortable table per project with summaries, first prompts, message counts, and git branches
- **Light/dark theme** — toggle between light and dark modes, or follow system preference

## Installation

Requires [Node.js](https://nodejs.org/) 20+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions in `~/.claude/`.

### npx (no install)

```sh
npx claude-inspector
```

### Global install

```sh
npm install -g claude-inspector
claude-inspector
```

Open [http://localhost:5174](http://localhost:5174).

### Environment variables

| Variable           | Default     | Description                        |
| ------------------ | ----------- | ---------------------------------- |
| `PORT`             | `5174`      | Server port                        |
| `HOST`             | `localhost` | Server host                        |
| `CLAUDE_DATA_PATH` | `~/.claude` | Path to Claude Code data directory |

## Development

```sh
git clone https://github.com/DavidTeju/claude-inspector.git
cd claude-inspector
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Optional: Session summaries

Add an Anthropic API key in Settings to auto-generate short titles for sessions using Haiku. Without it, the first user prompt is shown as the title instead.

## Search Filters

- `tool:Read` — sessions that used a specific tool
- `branch:main` — sessions on a specific git branch
- `is:error` — sessions with API errors
- `is:subagent` — subagent sessions only
- `has:tokens` / `has:cost` — sessions with token usage data
- `mode:raw` — bypass SQLite and scan JSONL files directly via ripgrep

## Tech Stack

- **SvelteKit 2** + **Svelte 5** (runes)
- **Tailwind CSS v4**
- **shiki** — syntax highlighting
- **marked** — markdown rendering
- **better-sqlite3** — session index and search
- **@vscode/ripgrep** — raw full-text search fallback
- **@anthropic-ai/claude-agent-sdk** — live session management
- **TypeScript** throughout

## Architecture

Standard SvelteKit layout under `src/`:

- **`lib/server/`** — all backend logic: JSONL session parsing, SQLite index with background reconciler, ripgrep-powered search, live session management via the Claude Agent SDK, and project/session discovery
- **`lib/components/`** — Svelte 5 UI components: conversation rendering (message threading, tool calls, thinking blocks, code highlighting), search with structured filters, live session controls (composer, permissions, interrupts), and navigation
- **`lib/shared/`** — types and constants shared between client and server (models, permission modes, session state)
- **`lib/stores/`** — Svelte rune-based client state (active session, theme, modals)
- **`routes/`** — pages for home (search + project grid), project session lists, session viewer, and settings
- **`routes/api/`** — SSE search endpoint, filter suggestions, and live session APIs (start, stream, send, permission, interrupt)

## Scripts

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run test         # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run test:coverage # Run Vitest with coverage
```

## License

MIT
