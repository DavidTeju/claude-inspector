# Claude Inspector

A local web UI for browsing, searching, and reading your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) session history. Claude Code stores all conversations as JSONL files in `~/.claude/projects/` — this app gives you a searchable, navigable interface to explore them.

![Home page with project grid and search](screenshots/home.png)

## Features

- **Ripgrep-powered full-text search** — searches actual conversation content across all sessions, not just metadata. Results stream in progressively via SSE with highlighted match snippets.

![Search with highlighted results](screenshots/search.png)

- **Session viewer** — full conversation renderer with user/assistant threading, collapsible tool calls with paired input/result, collapsible thinking blocks, and syntax-highlighted code blocks (shiki).

![Session viewer with messages and tool calls](screenshots/session.png)

- **Project browser** — lists all projects with session counts and relative timestamps
- **Session list** — sortable table per project with summaries, first prompts, message counts, and git branches
- **Dark theme** — monospace code editor aesthetic

## Quick Start

```sh
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Configuration

By default, reads data from `~/.claude/`. Override with the `CLAUDE_DATA_PATH` environment variable:

```sh
CLAUDE_DATA_PATH=/path/to/claude/data npm run dev
```

### Optional: Session summaries

Add an Anthropic API key in Settings to auto-generate short titles for sessions using Haiku. Without it, the first user prompt is shown as the title instead.

## How Search Works

Search uses [ripgrep](https://github.com/BurntSushi/ripgrep) (bundled via `@vscode/ripgrep`) to search JSONL files at query time:

1. `rg` scans all `.jsonl` files with `--fixed-strings` (safe — user input is never interpreted as regex)
2. Each match is parsed and filtered to only `user`/`assistant` text content (skips tool inputs, thinking blocks, progress records)
3. Results stream to the client via Server-Sent Events for progressive rendering
4. Falls back to metadata-only search if the rg binary is unavailable

## Tech Stack

- **SvelteKit 2** + **Svelte 5** (runes)
- **Tailwind CSS v4**
- **shiki** — syntax highlighting
- **marked** — markdown rendering
- **@vscode/ripgrep** — full-text search
- **TypeScript** throughout
- **Zero database** — reads JSONL files directly from disk

## Architecture

```
src/
├── lib/
│   ├── types.ts                     # Shared TypeScript interfaces
│   ├── utils.ts                     # Shared utilities (date formatting, highlighting)
│   ├── server/
│   │   ├── paths.ts                 # Data root resolution (~/.claude or env override)
│   │   ├── projects.ts              # Project listing, dir name parsing
│   │   ├── sessions.ts              # Session index reading, JSONL fallback scanning
│   │   ├── messages.ts              # JSONL stream parser, threading, tool pairing
│   │   ├── search.ts                # Ripgrep-based full-text search with SSE streaming
│   │   ├── reconciler.ts            # Background session index builder
│   │   └── config.ts                # App configuration (API key, etc.)
│   └── components/
│       ├── Sidebar.svelte           # Project navigation
│       ├── TopBar.svelte            # Breadcrumbs + search icon
│       ├── ProjectCard.svelte       # Project summary card
│       ├── SearchResultCard.svelte  # Search result with highlighted snippet
│       ├── MessageThread.svelte     # Conversation renderer
│       ├── UserMessage.svelte       # User message bubble
│       ├── AssistantMessage.svelte  # Assistant message block
│       ├── ToolUseBlock.svelte      # Collapsible tool call + result
│       ├── ThinkingBlock.svelte     # Collapsible thinking block
│       ├── MarkdownContent.svelte   # Markdown → HTML with code extraction
│       └── CodeBlock.svelte         # Syntax-highlighted code via shiki
├── routes/
│   ├── +layout.svelte               # Root layout: sidebar + top bar
│   ├── +layout.server.ts            # Load project list
│   ├── +page.svelte                 # Home: spotlight search + project grid
│   ├── projects/[projectId]/        # Session list for a project
│   ├── session/[projectId]/[sessionId]/ # Message viewer
│   ├── settings/                    # API key configuration
│   └── api/search/                  # SSE search endpoint
└── app.css                          # Tailwind v4 theme
```

## Scripts

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
```

## License

MIT
